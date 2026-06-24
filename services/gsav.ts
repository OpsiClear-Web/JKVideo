// diveo config adapter over the shared @opsiclear/gsav-client (World B, Plan B).
// The catalog client + types + defensive normalizers now live in the package
// (one source of truth, shared with gsav-hosting); here we just inject diveo's
// env config and re-export the surface so existing consumers (hooks, components,
// tests) keep importing from services/gsav unchanged.
import { createGsavCatalog } from "@opsiclear/gsav-client";

export * from "@opsiclear/gsav-client";

export const DEFAULT_CATALOG_URL = "http://127.0.0.1:54321/functions/v1/catalog";

export const gsavCatalog = createGsavCatalog({
  catalogUrl: process.env.EXPO_PUBLIC_GSAV_CATALOG_URL ?? DEFAULT_CATALOG_URL,
  anonKey: process.env.EXPO_PUBLIC_GSAV_SUPABASE_ANON_KEY,
});
