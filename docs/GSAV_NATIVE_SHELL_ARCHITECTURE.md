# diveo Native Shell — Architecture

How the diveo React Native app hosts the GSAV 4DGS web player. This is the single
end-to-end reference for the shell: ownership boundary, WebView trust model, the
native↔web bridge, and the release/distribution pipeline.

- **GSAV** = the codec / `.gsav` format / wire protocol (technical, stays "GSAV").
- **diveo** = the product / app (user-facing).
- Decision history: [`docs/adr/0001-gsav-pivot.md`](adr/0001-gsav-pivot.md).
- Cross-repo contract: [`GSAV_4DGS_HOSTING_IMPLEMENTATION_CHECKLIST.md`](../GSAV_4DGS_HOSTING_IMPLEMENTATION_CHECKLIST.md).

## Ownership boundary

```
  diveo native shell (this repo)            gsav-hosting (../gsav-hosting)
  ──────────────────────────────            ──────────────────────────────
  • WebView host + lifecycle                • the 4DGS web app (catalog, player)
  • origin allowlist / trust gates          • .gsav decoding & rendering
  • native↔web bridge (typed messages)      • scene data model, CDN/R2 URLs
  • deep links by scene id                  • account/entitlement (future)
  • self-updater (Android APK)              • owns ALL catalog/playback logic

  Rule: the shell NEVER owns a catalog. It deep-links scene ids via
  buildGsavWatchPath(sceneId) — an id passthrough, not a catalog query.
```

## Component map

| File | Role |
|---|---|
| `components/GsavWebView.tsx` | the host: WebView config, trust gates, lifecycle, applies bridge effects |
| `components/GsavScreen.tsx` | shared screen for `/watch/:id` + `/gsav/:id` |
| `app/watch/[id].tsx`, `app/gsav/[id].tsx` | route re-exports (alias) |
| `app/gsav-diagnostics.tsx` | diagnostics route |
| `app/index.tsx` (`GsavHomeEntry`) | home launcher entry → deep-links a scene |
| `utils/gsavBridge.ts` | **all pure logic**: protocol types, URL/origin helpers, trust gates, version-compat, `reduceBridgeEvent` |
| `hooks/useCheckUpdate.ts` | in-app APK self-updater (Android) |

Design rule: pure logic lives in `gsavBridge.ts` and is unit-tested; the component is
a thin shell that wires React Native I/O to those pure functions.

## WebView trust model

Two independent gates, both fail-closed. An unconfigured/malformed origin renders a
"diveo not configured" panel instead of loading anything.

```
 configured origin: https://gsav.example   (getConfiguredGsavWebUrl → getOrigin)
 ┌──────────────────────────────────────────────────────────────────────┐
 │ WebView (originWhitelist = [allowedOrigin], mixedContentMode=never*)   │
 │                                                                        │
 │  NAVIGATION GATE  onShouldStartLoadWithRequest                         │
 │    isAllowedGsavNavigation(url, allowedOrigin)                         │
 │      ├─ https://gsav.example/watch/x   → ALLOW (exact origin match)    │
 │      ├─ https://evil.example/x         → BLOCK → Linking.openURL       │
 │      └─ about: / javascript: / empty   → BLOCK (no origin, fail-closed)│
 │                                                                        │
 │  MESSAGE GATE     onMessage                                            │
 │    isTrustedBridgeOrigin(event.nativeEvent.url's origin, allowedOrigin)│
 │      ├─ from https://gsav.example      → TRUST → reduceBridgeEvent     │
 │      └─ from an embedded foreign frame → DROP (no native effect)       │
 └──────────────────────────────────────────────────────────────────────┘
 * mixedContentMode: "never" in production, "compatibility" only in __DEV__.
```

Why two gates: the navigation gate controls what the WebView may *load*; the message
gate controls which postMessages the native side *trusts*. A page that slips a foreign
iframe in still cannot drive native commands.

## Native ↔ web bridge

```
 WEB (gsav-hosting)                         NATIVE (diveo shell)
 ─────────────────                          ────────────────────
 window.ReactNativeWebView                  onMessage
   .postMessage(JSON)        ───────────►   parseBridgeMessage   (JSON + type guard)
                                            reduceBridgeEvent     (pure → effects)
                                              ├─ snapshot (updatePlaybackSnapshot)
                                              ├─ header label
                                              ├─ error banner (set/clear)
                                              └─ theme re-sync
 window.__GSAV_NATIVE_BRIDGE__              injectJavaScript(
   .handleCommand(JSON)      ◄───────────     buildNativeCommandScript(command))
```

Message types (`GsavBridgeMessage`): `GSAV_BRIDGE_READY`, `GSAV_READY`, `GSAV_ERROR`,
`GSAV_CAPABILITIES`, `GSAV_PROGRESS`, `GSAV_FRAME`, `GSAV_FIRST_FRAME`,
`GSAV_PLAYBACK_STATE`, `GSAV_PLAY/PAUSE/ENDED/DESTROY`.
Commands (`NativeGsavCommand`): `play`, `pause`, `seek`, `loadScene`, `setTheme`,
`setMuted`, `setFullscreenIntent`, `closeMiniPlayer`.

### Version negotiation

```
 GSAV_BRIDGE_READY { version, minVersion }   (web reports its supported range)
        │
        ▼  isBridgeCompatible(web, NATIVE_VERSION, NATIVE_MIN_VERSION)
   overlap?  web.version >= native.min  AND  native.version >= web.min
        ├─ yes → proceed
        └─ no  → show getBridgeMismatchMessage() ("diveo player version mismatch …")
```

A missing/garbled web version is treated as incompatible (fail-closed).

## Release / distribution pipeline

Sideloaded APK via GitHub Releases (not the Play Store). `release.yml` runs on push to
master and is gated so a broken or misconfigured build can never publish.

```
 push to master
   │
   ├─► quality.yml (reusable)      tsc · vitest · lint(diveo surface)   ── must pass
   │
   └─► release  (needs: quality, gate)
         gate: GSAV_WEB_URL set?  ── no → release SKIPPED (stays green)
                                  ── yes ▼
         verify-native-production-config   (https, non-local origin, no creds)
         expo prebuild → gradlew assembleRelease
         verify artifact:  bundle contains the configured origin
                           merged manifest usesCleartextTraffic=false
         bump version → commit [skip ci] → gh release create (APK)
```

Defense in depth against shipping a localhost/dev player: (1) `app.config.js` forces
`usesCleartextTraffic=false` in prod, (2) `getConfiguredGsavWebUrl` returns `null`
(fail-loud panel) in prod when unset, (3) the release gate + artifact check above.

## Testing

Pure logic is unit-tested (`utils/*.test.ts`, `scripts/*.test.mjs`, `app.config.test.mjs`).
`reduceBridgeEvent` covers the message→state wiring without rendering React Native.
Component-level render tests (react-native-testing-library) are not yet set up — the
RN render harness under vitest is the remaining test-infra gap.
