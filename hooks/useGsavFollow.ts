import { getChannelFollowerCount, isChannelFollowed, setChannelFollowed } from "@opsiclear/gsav-client";
import { useCallback, useEffect, useState } from "react";

import { supabase } from "../services/supabase";
import { useGsavAuthStore } from "../store/gsavAuthStore";

/**
 * Follow/unfollow a creator's channel (World B social). Backed by the shared
 * @opsiclear/gsav-client social ops (follows {profile_id, channel_id}; follower
 * count from the public channel_public_counts view). Reads follow + count on
 * mount; toggle is optimistic with rollback and requires a signed-in user.
 */
export function useGsavFollow(channelId: string | undefined, initialFollowerCount?: number) {
  const userId = useGsavAuthStore((s) => s.user?.id);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount ?? 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialFollowerCount !== undefined) setFollowerCount(initialFollowerCount);
  }, [initialFollowerCount]);

  useEffect(() => {
    if (!channelId) return;
    let active = true;
    (async () => {
      try {
        const count = await getChannelFollowerCount(supabase, channelId);
        if (active && count !== null) setFollowerCount(count);
      } catch {
        // keep current count
      }
      if (!userId) {
        if (active) setFollowing(false);
        return;
      }
      try {
        const followed = await isChannelFollowed(supabase, userId, channelId);
        if (active) setFollowing(followed);
      } catch {
        // keep current state
      }
    })();
    return () => {
      active = false;
    };
  }, [channelId, userId]);

  const toggle = useCallback(async () => {
    if (!channelId || !userId || busy) return;
    const next = !following;
    setBusy(true);
    setFollowing(next);
    setFollowerCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      await setChannelFollowed(supabase, userId, channelId, next);
    } catch {
      // rollback the optimistic update
      setFollowing(!next);
      setFollowerCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }, [channelId, userId, following, busy]);

  return { following, followerCount, busy, canFollow: Boolean(userId), toggle };
}
