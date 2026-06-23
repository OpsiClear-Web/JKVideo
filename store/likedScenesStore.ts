import { create } from "zustand";

import { supabase } from "../services/supabase";
import { useGsavAuthStore } from "./gsavAuthStore";

// World B social: per-scene likes. Mirrors gsav-hosting video_reactions
// {profile_id, video_id, kind:'like'} + the public video_public_counts.like_count.
// Holds the signed-in user's liked set + a videoId->count map. Counts are public
// (hydrated for visible scenes by the data hooks); likedIds needs auth. Toggle is
// optimistic with rollback.
type LikedScenesState = {
  likedIds: Set<string>;
  counts: Record<string, number>;
  load: () => Promise<void>;
  hydrateCounts: (videoIds: (string | undefined)[]) => Promise<void>;
  toggle: (videoBackendId: string) => Promise<void>;
};

export const useLikedScenesStore = create<LikedScenesState>((set, get) => ({
  likedIds: new Set(),
  counts: {},
  load: async () => {
    const userId = useGsavAuthStore.getState().user?.id;
    if (!userId) {
      set({ likedIds: new Set() });
      return;
    }
    const { data, error } = await supabase
      .from("video_reactions")
      .select("video_id")
      .eq("profile_id", userId)
      .eq("kind", "like");
    if (error) return;
    set({ likedIds: new Set((data ?? []).map((row) => String(row.video_id))) });
  },
  hydrateCounts: async (videoIds) => {
    const ids = [...new Set(videoIds.filter((v): v is string => Boolean(v)))];
    if (!ids.length) return;
    const { data, error } = await supabase
      .from("video_public_counts")
      .select("video_id, like_count")
      .in("video_id", ids);
    if (error) return;
    const next = { ...get().counts };
    for (const row of data ?? []) next[String(row.video_id)] = Number(row.like_count ?? 0);
    set({ counts: next });
  },
  toggle: async (videoBackendId) => {
    const userId = useGsavAuthStore.getState().user?.id;
    if (!userId || !videoBackendId) return;
    const wasLiked = get().likedIds.has(videoBackendId);
    const likedNext = new Set(get().likedIds);
    if (wasLiked) likedNext.delete(videoBackendId);
    else likedNext.add(videoBackendId);
    const countsNext = { ...get().counts };
    countsNext[videoBackendId] = Math.max(0, (countsNext[videoBackendId] ?? 0) + (wasLiked ? -1 : 1));
    set({ likedIds: likedNext, counts: countsNext });
    try {
      const result = wasLiked
        ? await supabase
            .from("video_reactions")
            .delete()
            .eq("profile_id", userId)
            .eq("video_id", videoBackendId)
            .eq("kind", "like")
        : await supabase.from("video_reactions").upsert({ profile_id: userId, video_id: videoBackendId, kind: "like" });
      if (result.error) throw result.error;
    } catch {
      const likedRb = new Set(get().likedIds);
      if (wasLiked) likedRb.add(videoBackendId);
      else likedRb.delete(videoBackendId);
      const countsRb = { ...get().counts };
      countsRb[videoBackendId] = Math.max(0, (countsRb[videoBackendId] ?? 0) + (wasLiked ? 1 : -1));
      set({ likedIds: likedRb, counts: countsRb });
    }
  },
}));
