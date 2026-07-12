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
export function toTrigramQuery(raw: string): string {
  const grams = new Set<string>();
  for (const tok of raw.toLowerCase().split(/[^a-z0-9а-яё]+/).filter(Boolean)) {
    for (let i = 0; i + 3 <= tok.length; i++) grams.add(tok.slice(i, i + 3));
  }
  return [...grams].map((g) => `"${g}"`).join(' OR ');
}
