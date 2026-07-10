import type { ActiveIngredientKey } from '@/types';

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
}

/** Row shape read from `ingredients` (autocomplete + tag vocabulary). */
export interface IngredientHit {
  inciName: string;
  activeKey: ActiveIngredientKey | null;
}
