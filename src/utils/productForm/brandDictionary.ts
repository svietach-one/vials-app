import dictionary from '../../../assets/brandDictionary/brandDictionary.json';

/**
 * OCR brand-correction seed dictionary — see
 * docs/specs/ocr-brand-dictionary-reference.md. The data lives in a bundled
 * JSON asset (assets/brandDictionary/brandDictionary.json) rather than
 * inline arrays so the list can be extended/corrected without touching code
 * (spec caveat 2: this is an unverified starting seed, not a closed list).
 *
 * Two brand pools split by script: OCR output must only ever be matched
 * against the pool of its own script (spec: "never cross-match"), which is
 * enforced in brandCorrection.ts. Latin transliterations of the Belarusian/
 * Russian brands are kept in the Latin pool too, since export packaging
 * often carries both spellings.
 */

type BrandDictionarySource = {
  latinBrands: string[];
  cyrillicBrands: string[];
  latinCommonTerms: Record<'en' | 'fr' | 'pl', string[]>;
  latinNameTerms: string[];
};

/** Trims entries and drops blanks + case-insensitive duplicates (the seed
 *  list is compiled from several retailer catalogs that overlap). */
function dedupe(entries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of entries) {
    const entry = raw.trim();
    const key = entry.toLowerCase();
    if (entry.length === 0 || seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

const source = dictionary as BrandDictionarySource;

export const LATIN_BRAND_DICTIONARY: string[] = dedupe(source.latinBrands);

export const CYRILLIC_BRAND_DICTIONARY: string[] = dedupe(source.cyrillicBrands);

/**
 * Category-relevant product-form terms per language (spec section 5, pruned
 * to the terms useful for category detection). categoryDetector.ts encodes
 * the fr/pl terms mapped onto the wizard's 8 category pills.
 */
export const LATIN_COMMON_TERMS: Record<'en' | 'fr' | 'pl', string[]> = {
  en: dedupe(source.latinCommonTerms.en),
  fr: dedupe(source.latinCommonTerms.fr),
  pl: dedupe(source.latinCommonTerms.pl),
};

/**
 * Single words plausible inside product NAMES (fruits, botanicals, actives,
 * descriptors — spec section 5). Used only for word-level fuzzy "Did you
 * mean" suggestions on OCR label lines ("prange" → "Orange"); never for
 * category detection.
 */
export const LATIN_NAME_TERMS: string[] = dedupe(source.latinNameTerms);
