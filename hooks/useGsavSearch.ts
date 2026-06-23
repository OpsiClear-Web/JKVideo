import { useCallback, useRef, useState } from "react";

import { gsavCatalog, type GsavContentItem } from "../services/gsav";
import { useLikedScenesStore } from "../store/likedScenesStore";

/**
 * GSAV catalog search (World B): full-text search via the catalog `q` param.
 * Last-write-wins (reqRef) so out-of-order responses can't clobber newer ones.
 */
export function useGsavSearch() {
  const [results, setResults] = useState<GsavContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const reqRef = useRef(0);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      reqRef.current++;
      setResults([]);
      setError(null);
      setLoading(false);
      setSearched(false);
      return;
    }
    const reqId = ++reqRef.current;
    setLoading(true);
    setError(null);
    try {
      const page = await gsavCatalog.search(trimmed);
      if (reqId === reqRef.current) {
        setResults(page.videos);
        setSearched(true);
        void useLikedScenesStore.getState().hydrateCounts(page.videos.map((v) => v.backendId));
      }
    } catch (e) {
      if (reqId === reqRef.current) setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, []);

  return { results, loading, error, searched, search };
}
