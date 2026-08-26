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

/**
 * A {@link CorpusProduct} after step-2 scoring (docs/tasks/ocr_improvement/
 * 03-scoring-and-cutoff.md). `ProductRepository.search()` returns this shape
 * instead of a bare `CorpusProduct[]` so every caller (and the eval harness)
 * can see, and threshold on, why a result was shown.
 */
export interface ScoredCorpusProduct extends CorpusProduct {
  /** 0..1, from scoreCandidate() — coverage of the query by this candidate. */
  score: number;
}

/** Row shape read from `ingredients` (autocomplete + tag vocabulary). */
export interface IngredientHit {
  inciName: string;
  activeKey: ActiveIngredientKey | null;
}

/**
 * Structured search input built at the call site (never inside
 * {@link CorpusQueryExecutor}'s consumers' repository) — the typed search bar
 * has no separate brand, an OCR label capture does. `origin` lets later steps
 * (see docs/tasks/ocr_improvement/03-scoring-and-cutoff.md) branch retrieval
 * strategy on whether the input is a clean typed string or noisy label OCR.
 */
export type ProductQuery = {
  /** May be absent — typed search has no separate brand line. */
  brand?: string;
  /** Always present; for typed search, the whole typed string. */
  name: string;
  origin: 'typed' | 'ocr';
  /** Original input, for telemetry/debugging — never queried on. */
  raw?: string;
};
