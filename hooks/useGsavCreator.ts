import { useEffect, useState } from "react";

import { gsavCatalog, type GsavContentItem, type GsavCreator } from "../services/gsav";
import { useLikedScenesStore } from "../store/likedScenesStore";

/**
 * GSAV creator profile (World B): one catalog call filtered by `channel` returns
 * the creator's scenes plus the creator record. The GSAV replacement for the
 * legacy Bilibili getUploaderInfo/getUploaderVideos.
 */
export function useGsavCreator(handle: string) {
  const [creator, setCreator] = useState<GsavCreator | null>(null);
  const [videos, setVideos] = useState<GsavContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const page = await gsavCatalog.byCreator(handle);
        if (!active) return;
        setVideos(page.videos);
        void useLikedScenesStore.getState().hydrateCounts(page.videos.map((v) => v.backendId));
        setCreator(page.creators.find((c) => c.handle === handle || c.id === handle) ?? page.creators[0] ?? null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load creator.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [handle]);

  return { creator, videos, loading, error };
}
