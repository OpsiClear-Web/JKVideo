import { useCallback, useEffect, useRef, useState } from "react";

import { gsavCatalog, type GsavContentItem } from "../services/gsav";
import { useLikedScenesStore } from "../store/likedScenesStore";

/**
 * Native GSAV feed (World B): reads the diveo catalog from gsav-hosting via
 * services/gsav. Auto-loads on mount; exposes pull-to-refresh and retry. The GSAV
 * replacement for the legacy Bilibili useVideoList.
 */
export function useGsavFeed() {
  const [items, setItems] = useState<GsavContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const page = await gsavCatalog.feed();
      setItems(page.videos);
      void useLikedScenesStore.getState().hydrateCounts(page.videos.map((v) => v.backendId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the diveo catalog.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    items,
    loading,
    refreshing,
    error,
    reload: () => load(false),
    refresh: () => load(true),
  };
}
