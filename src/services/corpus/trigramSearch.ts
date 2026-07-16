/**
 * FTS5 trigram tokenizer does SUBSTRING matching, not similarity. To tolerate
 * OCR/typo noise ("The 0rdinary" → "The Ordinary"), decompose the query into
 * character trigrams and OR them; rank by bm25 overlap at the call site.
 *
 * Tokens shorter than 3 chars contribute no trigrams (expected). If the whole
 * query yields no trigrams, the caller should skip the FTS call and return [].
 *
 * Includes the Cyrillic block (а-я, ё) alongside a-z0-9 so `vials_seed` rows
 * with Cyrillic names — searchable via `search_norm` — actually get trigrams
 * instead of being silently dropped.
 */
export function toTrigrams(raw: string): Set<string> {
  const grams = new Set<string>();
  for (const tok of raw.toLowerCase().split(/[^a-z0-9а-яё]+/).filter(Boolean)) {
    for (let i = 0; i + 3 <= tok.length; i++) grams.add(tok.slice(i, i + 3));
  }
  return grams;
}

export function toTrigramQuery(raw: string): string {
  return [...toTrigrams(raw)].map((g) => `"${g}"`).join(' OR ');
}

/**
 * Jaccard similarity of two trigram sets (0..1). Shared by corpus FTS
 * ranking concerns and the OCR brand-correction dictionary
 * (src/utils/productForm/brandCorrection.ts) — keep the one implementation.
 */
export function trigramJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const gram of a) {
    if (b.has(gram)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}
