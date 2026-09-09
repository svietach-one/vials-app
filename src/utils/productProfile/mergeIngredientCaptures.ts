/**
 * Merges two ingredient-list OCR captures taken of the same product (round
 * jar / long packaging split across two photos) into one deduplicated list.
 * docs/investigations/ocr-incomplete-ingredient-capture.md §4.
 *
 * Text-level merge, not image stitching: a label wrapped around a jar is a
 * cylinder photographed from outside, so pixel-level panorama stitching
 * would need per-device camera intrinsics and jar-radius estimation to
 * dewarp — disproportionate for this stack. Aligning the two token streams
 * instead reuses the tokenizer every other ingredient-text consumer in this
 * codebase already shares.
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */
import { tokenizeIngredientsText } from './resolve';

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, (_, i) => [
    i,
    ...Array(cols - 1).fill(0),
  ]);
  for (let j = 1; j < cols; j++) distances[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost,
      );
    }
  }
  return distances[rows - 1][cols - 1];
}

/** Tolerant of the OCR noise that makes the same ingredient read slightly
 *  differently between two independent scans of the same physical text. */
function tokensMatch(a: string, b: string): boolean {
  const na = normalizeToken(a);
  const nb = normalizeToken(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const maxLen = Math.max(na.length, nb.length);
  if (maxLen < 4) return false; // too short to trust a fuzzy match
  return levenshteinDistance(na, nb) / maxLen <= 0.25;
}

/**
 * Finds the largest suffix-of-first / prefix-of-second overlap and returns
 * the combined, deduplicated token list. When no overlap is found (the user
 * didn't overlap the two shots), this is a plain concatenation.
 */
export function mergeIngredientCaptures(firstText: string, secondText: string): string {
  const firstTokens = tokenizeIngredientsText(firstText);
  const secondTokens = tokenizeIngredientsText(secondText);

  if (firstTokens.length === 0) return secondText.trim();
  if (secondTokens.length === 0) return firstText.trim();

  const maxOverlap = Math.min(firstTokens.length, secondTokens.length);
  let overlapLength = 0;
  for (let len = maxOverlap; len > 0; len--) {
    const tail = firstTokens.slice(firstTokens.length - len);
    const head = secondTokens.slice(0, len);
    if (tail.every((token, i) => tokensMatch(token, head[i]))) {
      overlapLength = len;
      break;
    }
  }

  return [...firstTokens, ...secondTokens.slice(overlapLength)].join(', ');
}
