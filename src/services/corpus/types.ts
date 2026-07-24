import type { ActiveIngredientKey } from '@/types';

/**
 * Minimal query surface the corpus repositories depend on. Deliberately a
 * subset of expo-sqlite's `SQLiteDatabase` so the repositories stay agnostic
 * to the transport: it is implemented by the remote {@link TursoHttpClient}
 * (network, works in Expo Go) and would also be satisfied by a local
 * `SQLiteDatabase` handle. `params` is always an array of bind values.
 */
export interface CorpusQueryExecutor {
  getFirstAsync<T>(sql: string, params: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params: unknown[]): Promise<T[]>;
}

/** Row shape read from the `products` table of the corpus DB (see corpus_schema.sql). */
export interface CorpusProduct {
  uid: string; // app-facing id (products.uid) — store this on the shelf, not the internal rowid
  barcode: string | null;
  brand: string | null;
  name: string;
  type: string; // app product-type vocabulary; reconcile with ProductType at the call site
  inciRaw: string | null;
  imageUrl: string | null;
  source: 'obf_import' | 'vials_seed' | 'community';
  /** Product page URL — populated for vials_seed rows, NULL for obf_import (schema v2.1). */
  url: string | null;
  /** Latin transliteration of `name` — populated for ~594 vials_seed rows (schema v2.1). */
  nameLacin: string | null;
}

/** Row shape read from `ingredients` (autocomplete + tag vocabulary). */
export interface IngredientHit {
  inciName: string;
  activeKey: ActiveIngredientKey | null;
}
