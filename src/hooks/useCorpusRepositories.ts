import { useMemo } from 'react';

import { useCorpusDb } from '@/providers/CorpusProvider';
import { IngredientRepository } from '@/services/corpus/IngredientRepository';
import { ProductRepository } from '@/services/corpus/ProductRepository';

/** Null when the corpus isn't configured/reachable — treat like a manual-entry fallback. */
export function useProductRepository(): ProductRepository | null {
  const db = useCorpusDb();
  return useMemo(() => (db ? new ProductRepository(db) : null), [db]);
}

/** Null when the corpus isn't configured/reachable — treat like a manual-entry fallback. */
export function useIngredientRepository(): IngredientRepository | null {
  const db = useCorpusDb();
  return useMemo(() => (db ? new IngredientRepository(db) : null), [db]);
}
