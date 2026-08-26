/**
 * Shared string-comparison normalization for the product-search precision fix
 * (docs/tasks/ocr_improvement/00-README.md "Shared conventions" — the exact
 * function body specified there). Used by every step that compares strings
 * in JS: the corpus scorer (scoreCandidate.ts), the typed-search tier
 * classifier (typedRanking.ts), and — per the step-0 doc — reusable by later
 * steps (stopwords, word-level FTS).
 *
 * Pure: no React, no react-native, no store access — importable from any
 * layer per .claude/rules/architecture-review.md's utils/services layering.
 */
export const normalizeForMatch = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // Avène → avene (corpus is French-heavy)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
