import { getSavedVideoIds, setVideoSaved } from "@opsiclear/gsav-client";
import { create } from "zustand";

import { supabase } from "../services/supabase";
import { useGsavAuthStore } from "./gsavAuthStore";

// World B social: the signed-in user's saved (bookmarked) scenes. Backed by the
// shared @opsiclear/gsav-client social ops over gsav-hosting's saved_videos
// {profile_id, video_id}; holds a Set of video backendIds. Reloaded on auth
// change (see app/_layout). Toggle is optimistic with rollback.
type SavedScenesState = {
  savedIds: Set<string>;
  load: () => Promise<void>;
  toggle: (videoBackendId: string) => Promise<void>;
};

export const useSavedScenesStore = create<SavedScenesState>((set, get) => ({
  savedIds: new Set(),
  load: async () => {
    const userId = useGsavAuthStore.getState().user?.id;
    if (!userId) {
      set({ savedIds: new Set() });
      return;
    }
    try {
      const ids = await getSavedVideoIds(supabase, userId);
      set({ savedIds: new Set(ids) });
    } catch {
      // keep current set on load failure
    }
  },
  toggle: async (videoBackendId) => {
    const userId = useGsavAuthStore.getState().user?.id;
    if (!userId || !videoBackendId) return;
    const wasSaved = get().savedIds.has(videoBackendId);
    const optimistic = new Set(get().savedIds);
    if (wasSaved) optimistic.delete(videoBackendId);
    else optimistic.add(videoBackendId);
    set({ savedIds: optimistic });
    try {
      await setVideoSaved(supabase, userId, videoBackendId, !wasSaved);
    } catch {
      const rollback = new Set(get().savedIds);
      if (wasSaved) rollback.add(videoBackendId);
      else rollback.delete(videoBackendId);
      set({ savedIds: rollback });
    }
  },
}));
