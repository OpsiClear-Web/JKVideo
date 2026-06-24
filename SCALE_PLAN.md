# diveo Scale Plan — scene-social bridge + shared client SDK

Two implementation plans toward the principled large-scale design (one source of
truth per concern; clients consume shared packages/contracts, never mirror each
other). Plan A ships scene-level social (comments/danmaku) the principled way;
Plan B removes the duplication that's already accruing.

Repos: **diveo** = `JKVideo` (RN native client) · **gsav-hosting** = `../gsav-hosting`
(web app + Supabase) · **gsavjs** = `../gsavjs` (shared GSAV packages, incl. the
vendored `@opsiclear/gsav-viewer`).

The native/web boundary this plan assumes:
- **Native owns:** app shell, browse-as-launcher (feed/search/creator), saves/
  follows (browse-level), downloads/offline, push, deep links.
- **Embedded web owns:** the player + scene-tightly-coupled social (comments,
  danmaku, in-player like) — built once in gsav-hosting, reused.

---

## Plan A — Scene-social via the session-bridge contract

**Goal.** A signed-in diveo user can use the player's *existing* comments /
danmaku / in-player like, by bridging the native Supabase session into the
embedded player. No native comment/danmaku UI is built (it already exists in
gsav-hosting's `SocialPanel` + `GsavViewer`; the only gap is auth).

**Outcome.** Tap a scene → the player shows the user logged-in → posting a
comment, sending danmaku, and liking work and persist to Supabase.

### A.1 The bridge message contract (the actual deliverable)
Add three versioned messages (origin-checked) to the native↔web bridge:

| Message | Dir | Payload | Effect in player |
|---|---|---|---|
| `GSAV_AUTH_READY` | web → shell | `{ bridgeVersion }` | player signals it can receive a session |
| `GSAV_SET_SESSION` | shell → web | `{ accessToken, refreshToken }` | `supabase.auth.setSession(...)` |
| `GSAV_CLEAR_SESSION` | shell → web | `{}` | `supabase.auth.signOut({ scope: 'local' })` |

Both transports surface as a `window` `message` event in the page:
- **Web (8081 iframe → 5173):** `iframe.contentWindow.postMessage(msg, gsavOrigin)`; player verifies `event.origin ∈ allowlist`.
- **Native (WebView):** `webView.injectJavaScript(postScript)`; trusted by
  construction (the shell owns the WebView), still shape/version checked.

### A.2 gsav-hosting work (`../gsav-hosting`)
1. **`apps/web/src/native/authBridge.ts`** — `window.addEventListener('message', …)`:
   validate origin against `VITE_GSAV_ALLOWED_SHELL_ORIGINS` (allowlist) + shape +
   `bridgeVersion`; dispatch `setSession` / `signOut` on `getSupabaseClient()`.
   Emit `GSAV_AUTH_READY` on mount. Enabled only in embed/native mode.
2. **Player surface mode** — today the shell loads the *full* page (social shows,
   but so does the site nav → double chrome). Add **`embed=shell`** to
   `watch.$id.tsx` + layout: render `GsavViewer` + `SocialPanel` + danmaku but
   **hide the site top-nav/footer**. (Distinct from `embed=native`, which hides
   social entirely.)
3. Security review: origin allowlist; never log tokens; the token is the user's
   own and targets the same Supabase project.

### A.3 diveo work (`JKVideo`)
1. **`components/GsavWebView.tsx` (native)** — load `…/watch/:id?embed=shell`; on
   `onLoadEnd` + on `gsavAuthStore` session change, `injectJavaScript` a
   `GSAV_SET_SESSION` post (from `gsavAuthStore.session`); on sign-out inject
   `GSAV_CLEAR_SESSION`.
2. **`components/GsavWebView.web.tsx` (web)** — `iframe` ref; on iframe `onLoad`
   and on `GSAV_AUTH_READY`, `postMessage` `GSAV_SET_SESSION` to `gsavOrigin`;
   resend on auth change.
3. **Bridge message types** — add to `utils/gsavBridge.ts` now; migrate to the
   shared `@opsiclear/gsav-bridge` in Plan B.
4. **Boundary cleanup** — scene-level like now lives in the player; either retire
   the native like heart on cards (one like surface) or keep it (same table,
   consistent). Keep **save + follow** native (browse-level). Decide + record.

### A.4 Verification
- Native + web: log in → open scene → player shows logged-in → post a comment →
  confirm a row in `comments` (curl) → send danmaku → like in-player toggles.
- Negative: a `postMessage` from a non-allowlisted origin is ignored.

### A.5 Risks / estimate
- Token refresh: after `setSession` the player's client auto-refreshes; the shell
  also re-injects on its own auth change. Confirm long-session behavior.
- `embed=shell` CSS/layout scoping in gsav-hosting.
- **Estimate: ~2–4 days** (gsav-hosting listener + `embed=shell` + allowlist;
  diveo native inject + web postMessage; test both targets).

---

## Plan B — Extract `@opsiclear/gsav-client` (+ `@opsiclear/gsav-bridge`)

**Goal.** One shared SDK for data + auth + social, consumed by **both**
gsav-hosting and diveo — replacing the mirrors (diveo's `services/gsav.ts` +
social stores re-implement gsav-hosting's `socialApi.ts`; `GsavContentItem`/
`GsavCreator` copy `Video`/`Creator`; `gsavBridge.ts` mirrors `native/bridge.ts`).

**Outcome.** A schema/query/protocol change happens in one package; both apps get
it; the duplicated files are deleted.

### B.1 Package: `@opsiclear/gsav-client`
- **Location:** `gsavjs/packages/client` (monorepo, alongside `gsav-viewer`/`core`/
  `decoder`). Built (tsup/rollup → ESM+CJS+`.d.ts`), **vendored as a tgz** like
  `@opsiclear/gsav-viewer` today; later published to a private registry.
- **Platform-agnostic:** no DOM/RN specifics. `@supabase/supabase-js` is a
  **peer dep**; the storage adapter (AsyncStorage native / localStorage web) and
  fetch are **injected**.
- **Contents:**
  - `types.ts` — canonical `Video`, `Creator`, `DanmakuItem`, `CatalogQuery`,
    `CatalogPage`, `SocialState`, `SocialComment`, `SocialCounts`.
  - `catalog.ts` — `list/page/get/search/related/listCreators/getCreator/
    videosByCreator` (from `api-catalog.ts`, decoupled from the web app).
  - `social.ts` — `getVideoSocialState`, `setVideoLiked/Saved`,
    `setChannelFollowed`, `addVideoComment`, follow/save/like set loaders (from
    `socialApi.ts`, which is already `SupabaseClient`-agnostic).
  - `createGsavClient({ supabaseUrl, supabaseKey, storage, catalogUrl })` → the
    supabase client + bound catalog/social. Normalizers live here (one copy).

### B.2 gsav-hosting migration
- Replace `backend/socialApi.ts` + `catalog/api-catalog.ts` with package imports
  (keep `static-catalog` as a provider option). Replace local `Video`/`Creator`
  with package types. Green: `apps/web` unit + e2e + build.

### B.3 diveo migration
- Replace `services/gsav.ts` (catalog client + types) with the package.
- `savedScenesStore` / `likedScenesStore` / `useGsavFollow` delegate IO to
  `social.*` (stores stay as thin zustand state). Replace `GsavContentItem`/
  `GsavCreator` with package types (alias to minimize churn).
- Green: `tsc` + `lint` + `vitest` + live local backend (feed/search/creator/
  follow/save/like unchanged).

### B.4 `@opsiclear/gsav-bridge`
- Extract the bridge protocol (message/command types incl. Plan A's
  `GSAV_SET_SESSION`, version negotiation, origin helpers) into a shared package;
  the **player (web)** and **shell (native)** both import it. Deletes the two
  mirrored bridge files.

### B.5 Build / CI
- tgz vendor step (or workspace links in dev). Monorepo CI: a shared-package
  change runs **both** gsav-hosting and diveo checks.

### B.6 Risks / estimate
- Cross-platform build (Hermes + web; only `fetch`/`URL`, no Node/DOM-only).
- Vendoring/version friction → workspace-link in dev, tgz for releases.
- Migrate incrementally (types → catalog → social), each step green.
- **Estimate: ~1–2 weeks** (scaffold + extraction + 2 migrations + build/CI);
  the bridge package ~2–3 days of that.

---

## Cross-cutting: dev/prod parity fixes (do alongside)
These are currently per-client workarounds; fix them at the source:
1. **`seed.sql`** — seed `auth.users` token columns as `''` not NULL (the gotrue
   "converting NULL to string" login 500).
2. **Catalog** — return social counts (view/like) so the feed needn't N+1; fix the
   **service client under the new Supabase key format** (the `?id=` /
   `gsavCatalog.scene()` path 500s today).
3. **Local asset fixtures** — seed `gsav-public` storage + manifests for the demo
   scenes (so posters render and the local catalog gate isn't bypassed ad hoc).
4. **Document the catalog/API contract** (the consumer surface of `gsav-client`).

---

## Sequencing & recommendation
- **A then B (recommended).** Plan A is small, user-visible, and *validates the
  boundary* (scene-social = embedded web). It only adds one bridge message to
  consolidate later. Then do Plan B as a focused refactor **before** building any
  further native social, so duplication stops growing.
- **B then A** if you'd rather halt duplication first; A then lands `setSession`
  directly in the shared `gsav-bridge`.
- Either way: **do not add more native social surfaces** (native comments/danmaku)
  — the boundary says those live in the player.

## Definition of done
- A: comments + danmaku + in-player like work for a signed-in diveo user on native
  and web; origin-checked; one like surface chosen.
- B: `@opsiclear/gsav-client` + `@opsiclear/gsav-bridge` consumed by both apps;
  `services/gsav.ts` social/type mirrors + `socialApi.ts` duplication removed; both
  apps green in CI; one schema change proven to propagate to both.
