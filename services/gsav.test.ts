import { describe, it, expect } from "vitest";

import {
  getSavedVideoIds,
  isChannelFollowed,
  normalizeCatalogPage,
  normalizeContentItem,
  normalizeCreator,
  normalizeDanmaku,
  setChannelFollowed,
  setVideoSaved,
} from "./gsav";

describe("normalizeContentItem", () => {
  it("maps a full catalog video", () => {
    const item = normalizeContentItem({
      id: "elly",
      backendId: "vid-uuid",
      title: "Elly Portrait Capture",
      author: "OpsiClear",
      creatorId: "opsiclear",
      posterUrl: "https://cdn/posters/elly.svg",
      gsavUrl: "https://cdn/processed/elly.gsav",
      durationSec: 12,
      gaussians: 1000,
      category: "Featured",
      tags: ["portrait", "4d"],
      danmakus: [{ time: 1, mode: 1, fontSize: 24, color: 16777215, text: "hi" }],
    });
    expect(item).toMatchObject({
      id: "elly",
      backendId: "vid-uuid",
      title: "Elly Portrait Capture",
      author: "OpsiClear",
      gsavUrl: "https://cdn/processed/elly.gsav",
      tags: ["portrait", "4d"],
    });
    expect(item?.danmakus).toHaveLength(1);
  });

  it("requires id and gsavUrl", () => {
    expect(normalizeContentItem({ id: "x" })).toBeNull(); // no gsavUrl
    expect(normalizeContentItem({ gsavUrl: "u" })).toBeNull(); // no id
    expect(normalizeContentItem(null)).toBeNull();
    expect(normalizeContentItem("nope")).toBeNull();
  });

  it("fills sane defaults and drops bad tags/danmakus", () => {
    const item = normalizeContentItem({
      id: "test",
      gsavUrl: "u",
      tags: ["ok", 5, null],
      danmakus: [{ text: "no-time" }, { time: 2, text: "good" }],
    });
    expect(item?.title).toBe("Untitled scene");
    expect(item?.author).toBe("Unknown");
    expect(item?.posterUrl).toBe("");
    expect(item?.tags).toEqual(["ok"]);
    expect(item?.danmakus).toEqual([{ time: 2, mode: 1, fontSize: 24, color: 0xffffff, text: "good" }]);
  });
});

describe("normalizeDanmaku", () => {
  it("keeps valid modes and defaults the rest", () => {
    expect(normalizeDanmaku({ time: 0, text: "a", mode: 5 })?.mode).toBe(5);
    expect(normalizeDanmaku({ time: 0, text: "a", mode: 9 })?.mode).toBe(1); // invalid → scroll
  });
  it("rejects entries without time or text", () => {
    expect(normalizeDanmaku({ time: 1 })).toBeNull();
    expect(normalizeDanmaku({ text: "x" })).toBeNull();
  });
});

describe("normalizeCreator", () => {
  it("maps a creator and falls back handle→id", () => {
    expect(normalizeCreator({ id: "c1", backendId: "ch-uuid", displayName: "Lab" })).toMatchObject({
      backendId: "ch-uuid",
      handle: "c1",
      displayName: "Lab",
      avatarUrl: "",
    });
  });
  it("requires a handle/id and a display name", () => {
    expect(normalizeCreator({ displayName: "x" })).toBeNull();
    expect(normalizeCreator({ handle: "h" })).toBeNull();
  });
});

describe("normalizeCatalogPage", () => {
  it("filters invalid rows and reads pagination", () => {
    const page = normalizeCatalogPage({
      videos: [
        { id: "a", gsavUrl: "u" },
        { id: "bad" }, // dropped (no gsavUrl)
      ],
      creators: [{ id: "c", displayName: "C" }, { nope: 1 }],
      page: { total: 42, nextCursor: "30" },
    });
    expect(page.videos.map((v) => v.id)).toEqual(["a"]);
    expect(page.creators.map((c) => c.id)).toEqual(["c"]);
    expect(page.total).toBe(42);
    expect(page.nextCursor).toBe("30");
  });

  it("is total-safe on garbage input", () => {
    expect(normalizeCatalogPage(null)).toEqual({ videos: [], creators: [] });
    expect(normalizeCatalogPage({})).toEqual({ videos: [], creators: [] });
  });
});

// --- shared social client (ported into @opsiclear/gsav-client) ---

type MockResult = { data?: unknown; error: { message: string } | null };
type MockChain = {
  select: (...a: unknown[]) => MockChain;
  insert: (...a: unknown[]) => MockChain;
  upsert: (...a: unknown[]) => MockChain;
  delete: (...a: unknown[]) => MockChain;
  eq: (...a: unknown[]) => MockChain;
  maybeSingle: () => Promise<MockResult>;
  single: () => Promise<MockResult>;
  then: (onF: (v: MockResult) => unknown, onR?: (e: unknown) => unknown) => Promise<unknown>;
};

// Records the table + query-builder calls so tests assert the query shape, and
// resolves every chain (await or maybeSingle/single) to `result`.
function mockClient(result: MockResult) {
  const ops: string[] = [];
  const makeChain = (): MockChain => {
    const chain: MockChain = {
      select: (..._a) => (ops.push("select"), chain),
      insert: (..._a) => (ops.push("insert"), chain),
      upsert: (..._a) => (ops.push("upsert"), chain),
      delete: (..._a) => (ops.push("delete"), chain),
      eq: (..._a) => (ops.push("eq"), chain),
      maybeSingle: () => (ops.push("maybeSingle"), Promise.resolve(result)),
      single: () => (ops.push("single"), Promise.resolve(result)),
      then: (onF, onR) => Promise.resolve(result).then(onF, onR),
    };
    return chain;
  };
  const client = {
    from: (table: string) => (ops.push(`from:${table}`), makeChain()),
  };
  return { client, ops };
}

describe("social client (shared @opsiclear/gsav-client)", () => {
  it("setVideoSaved(true) upserts saved_videos", async () => {
    const { client, ops } = mockClient({ error: null });
    await setVideoSaved(client, "u1", "v1", true);
    expect(ops).toEqual(["from:saved_videos", "upsert"]);
  });

  it("setVideoSaved(false) deletes by profile + video", async () => {
    const { client, ops } = mockClient({ error: null });
    await setVideoSaved(client, "u1", "v1", false);
    expect(ops).toEqual(["from:saved_videos", "delete", "eq", "eq"]);
  });

  it("getSavedVideoIds maps rows to id strings", async () => {
    const { client } = mockClient({ data: [{ video_id: "a" }, { video_id: 2 }], error: null });
    expect(await getSavedVideoIds(client, "u1")).toEqual(["a", "2"]);
  });

  it("isChannelFollowed reflects row presence", async () => {
    const present = mockClient({ data: { channel_id: "c1" }, error: null });
    const absent = mockClient({ data: null, error: null });
    expect(await isChannelFollowed(present.client, "u1", "c1")).toBe(true);
    expect(await isChannelFollowed(absent.client, "u1", "c1")).toBe(false);
  });

  it("propagates backend errors with a labeled message", async () => {
    const { client } = mockClient({ error: { message: "denied" } });
    await expect(setChannelFollowed(client, "u1", "c1", true)).rejects.toThrow("follow channel: denied");
  });
});
