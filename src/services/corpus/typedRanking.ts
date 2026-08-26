import { normalizeForMatch } from '@/utils/textNormalize';

import type { CorpusProduct, ProductQuery } from './types';

/**
 * Typed-search ranking tiers (docs/tasks/ocr_improvement/03-scoring-and-cutoff.md
 * "Typed search needs a different RECALL stage" / "Ranking tiers for typed
 * queries"). A human typing preserves prefixes; ranking by tier first makes
 * the search bar feel like search instead of the "arbitrary slice" bug this
 * step fixes. Pure — no React/react-native/store — see architecture-review.md.
 */
export type TypedTier = 1 | 2 | 3 | 4 | 5;

/**
 * Tier 1: exact match on normalized "brand name" or on name alone.
 * Tier 2: brand starts with the query.
 * Tier 3: name starts with the query.
 * Tier 4: any word inside the name starts with the query.
 * Tier 5: everything else (the fuzzy/trigram supplement — see
 *         ProductRepository's typed recall stage for when it's even fetched).
 */
export function classifyTypedTier(query: ProductQuery, candidate: CorpusProduct): TypedTier {
  const q = normalizeForMatch(query.name);
  if (q.length === 0) return 5;

  const brand = normalizeForMatch(candidate.brand ?? '');
  const name = normalizeForMatch(candidate.name);
  const combined = normalizeForMatch(`${candidate.brand ?? ''} ${candidate.name}`);

  if (q === combined || q === name) return 1;
  if (brand.length > 0 && brand.startsWith(q)) return 2;
  if (name.startsWith(q)) return 3;
  if (name.split(' ').some((word) => word.length > 0 && word.startsWith(q))) return 4;
  return 5;
}

/** Shape compareTypedCandidates needs: a scored CorpusProduct plus an optional rating_count for the tiebreak. */
export interface TypedRankable extends CorpusProduct {
  score: number;
  ratingCount?: number;
}

/**
 * Sort comparator for typed-search results: tier ASC, then step-2 score DESC,
 * then a deterministic tiebreak (`rating_count DESC, name ASC`) so typing one
 * more character narrows the list instead of reshuffling it — see "Stability
 * between keystrokes" in the step doc.
 */
export function compareTypedCandidates(query: ProductQuery) {
  return (a: TypedRankable, b: TypedRankable): number => {
    const tierA = classifyTypedTier(query, a);
    const tierB = classifyTypedTier(query, b);
    if (tierA !== tierB) return tierA - tierB;

    if (b.score !== a.score) return b.score - a.score;

    const ratingA = a.ratingCount ?? 0;
    const ratingB = b.ratingCount ?? 0;
    if (ratingB !== ratingA) return ratingB - ratingA;

    return a.name.localeCompare(b.name);
  };
}
