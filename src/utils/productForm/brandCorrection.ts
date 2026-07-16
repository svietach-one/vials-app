import { toTrigrams, trigramJaccard } from '@/services/corpus/trigramSearch';

import {
  CYRILLIC_BRAND_DICTIONARY,
  LATIN_BRAND_DICTIONARY,
  LATIN_COMMON_TERMS,
} from './brandDictionary';

export type BrandScript = 'latin' | 'cyrillic';

/**
 * Spec starting point (ocr-brand-dictionary-reference.md): tune against real
 * OCR output. At 0.6, a one-character OCR miss near the end of a brand name
 * clears the bar ("BIODERMO" → Bioderma) while unrelated words stay out.
 */
export const BRAND_SUGGESTION_THRESHOLD = 0.6;

/**
 * Dictionary entries this short ("The U" → one trigram, "G.Love" → two) make
 * Jaccard degenerate — a standalone stopword like "The" scores a perfect 1.0
 * against "The U". Entries below this floor are exact-match-only: they never
 * get offered as fuzzy corrections. The flip side (a typo inside a ≤4-char
 * brand can't be suggested) is the safe side of the trade.
 */
const MIN_ENTRY_TRIGRAMS = 3;

/**
 * Belarusian packaging spells the same brands with і/ў where the (Russian)
 * dictionary forms use и/у — "Вітэкс" vs "Витэкс". Fold before trigram
 * comparison only; the exact-match check keeps the raw spelling so the
 * dictionary form is still *offered* for a Belarusian-spelled line rather
 * than silently treated as identical. Scoped to brand matching on purpose —
 * the shared corpus trigram helper must keep agreeing with the FTS index's
 * own tokenizer.
 */
function foldBelarusian(text: string): string {
  return text.replace(/і/gi, 'и').replace(/ў/gi, 'у');
}

/**
 * Any Cyrillic letter (including Belarusian і/ў) routes the line to the
 * Cyrillic pool — OCR often drops lookalike Latin characters into a Cyrillic
 * word ("Мodum"), and those lines must still never be compared against the
 * Latin dictionary. Lines with no letters at all (digits, punctuation) match
 * nothing.
 */
export function detectScript(line: string): BrandScript | null {
  if (/[а-яёіў]/i.test(line)) return 'cyrillic';
  if (/[a-z]/i.test(line)) return 'latin';
  return null;
}

type PoolEntry = { brand: string; trigrams: Set<string> };

/** Fuzzy pools exclude entries below MIN_ENTRY_TRIGRAMS (exact-match-only). */
let pools: Record<BrandScript, PoolEntry[]> | null = null;

/** Dictionary trigram sets are computed once, on first use, not at startup. */
function getPools(): Record<BrandScript, PoolEntry[]> {
  if (pools === null) {
    const build = (brands: string[]): PoolEntry[] =>
      brands
        .map((brand) => ({ brand, trigrams: toTrigrams(foldBelarusian(brand)) }))
        .filter((entry) => entry.trigrams.size >= MIN_ENTRY_TRIGRAMS);
    pools = {
      latin: build(LATIN_BRAND_DICTIONARY),
      cyrillic: build(CYRILLIC_BRAND_DICTIONARY),
    };
  }
  return pools;
}

const DICTIONARIES: Record<BrandScript, string[]> = {
  latin: LATIN_BRAND_DICTIONARY,
  cyrillic: CYRILLIC_BRAND_DICTIONARY,
};

/** Marketing/category words ("Booster", "Krem") that plausibly stand alone on
 *  a label line and must never be "corrected" into a generic-word brand. */
let commonTermSet: Set<string> | null = null;

function isCommonTerm(normalizedLine: string): boolean {
  if (commonTermSet === null) {
    commonTermSet = new Set(
      Object.values(LATIN_COMMON_TERMS).flatMap((terms) => terms.map(normalize)),
    );
  }
  return commonTermSet.has(normalizedLine);
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Fuzzy-matches one OCR line against the brand dictionary of its own script
 * (never cross-script) and returns the best dictionary spelling, or null when
 * nothing clears the threshold. Returns null for lines that already spell a
 * dictionary brand (nothing to correct — case differences included, since
 * packaging is frequently all-caps).
 *
 * This function only *suggests*: callers must surface the result as a
 * user-confirmable option and never overwrite the raw OCR text with it
 * (spec caveat 3 — a rare real brand must not get silently "corrected" into
 * a more common neighbor).
 */
export function suggestBrandCorrection(
  line: string,
  threshold: number = BRAND_SUGGESTION_THRESHOLD,
): string | null {
  const script = detectScript(line);
  if (script === null) return null;

  const lineTrigrams = toTrigrams(foldBelarusian(line));
  if (lineTrigrams.size === 0) return null;

  const normalizedLine = normalize(line);
  if (DICTIONARIES[script].some((brand) => normalize(brand) === normalizedLine)) return null;
  if (isCommonTerm(normalizedLine)) return null;

  let best: { brand: string; score: number } | null = null;
  for (const entry of getPools()[script]) {
    const score = trigramJaccard(lineTrigrams, entry.trigrams);
    if (score >= threshold && (best === null || score > best.score)) {
      best = { brand: entry.brand, score };
    }
  }
  return best?.brand ?? null;
}
