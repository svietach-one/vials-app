import { detectScript, suggestBrandCorrection } from './brandCorrection';

describe('detectScript', () => {
  it('classifies a plain Latin line as latin', () => {
    expect(detectScript('Bioderma')).toBe('latin');
  });

  it('classifies a plain Cyrillic line as cyrillic', () => {
    expect(detectScript('Белита')).toBe('cyrillic');
  });

  it('routes mixed lookalike lines to cyrillic when any Cyrillic letter is present', () => {
    // OCR often drops Latin lookalikes into a Cyrillic word — the line must
    // still stay in the Cyrillic pool.
    expect(detectScript('Мodum')).toBe('cyrillic');
  });

  it('returns null when the line has no letters', () => {
    expect(detectScript('12345 +%')).toBeNull();
  });
});

describe('suggestBrandCorrection', () => {
  it('suggests the dictionary spelling for a Latin brand with a minor OCR typo', () => {
    // The spec's own OCR-noise example: zero misread as the letter O.
    expect(suggestBrandCorrection('The 0rdinary')).toBe('The Ordinary');
    // Trailing-letter misread.
    expect(suggestBrandCorrection('BIODERMO')).toBe('Bioderma');
  });

  it('suggests the Cyrillic dictionary spelling for a Cyrillic brand with a typo', () => {
    expect(suggestBrandCorrection('Витэкт')).toBe('Витэкс');
  });

  it('returns null when the line already spells a dictionary brand', () => {
    expect(suggestBrandCorrection('Bioderma')).toBeNull();
  });

  it('returns null for a case-only difference (packaging is frequently all-caps)', () => {
    expect(suggestBrandCorrection('BIODERMA')).toBeNull();
  });

  it('never corrects a Cyrillic line against the Latin pool', () => {
    // "Витэкт" is a typo of "Витэкс"; the Latin pool holds the
    // transliteration "Vitex". The suggestion must stay Cyrillic.
    const suggestion = suggestBrandCorrection('Витэкт');
    expect(suggestion).not.toBeNull();
    expect(/[a-z]/i.test(suggestion as string)).toBe(false);
  });

  it('never corrects a Latin line against the Cyrillic pool', () => {
    // "Vitexs" is a typo of the Latin "Vitex"; "Витэкс" also exists in the
    // Cyrillic pool but must never be offered for Latin input.
    const suggestion = suggestBrandCorrection('Vitexs');
    expect(suggestion).toBe('Vitex');
    expect(/[а-яё]/i.test(suggestion as string)).toBe(false);
  });

  it('returns null when nothing clears the similarity threshold', () => {
    expect(suggestBrandCorrection('Xyzzq Wtrfl')).toBeNull();
  });

  it('returns null for lines too short to produce trigrams', () => {
    expect(suggestBrandCorrection('AB')).toBeNull();
    expect(suggestBrandCorrection('')).toBeNull();
  });

  it('never offers tiny dictionary entries as fuzzy corrections for stopword lines', () => {
    // "The U" has a single trigram ("the") — a standalone "The" line (e.g.
    // "The Ordinary" wordmark split across OCR lines) scored a perfect 1.0
    // against it before entries under the trigram floor were made
    // exact-match-only.
    expect(suggestBrandCorrection('The')).toBeNull();
    expect(suggestBrandCorrection('Love')).toBeNull();
  });

  it('never corrects a line that is itself a common marketing/category term', () => {
    // "Booster" is a standalone marketing word on many labels and must not
    // be corrected into the generic-word brand "booster bar".
    expect(suggestBrandCorrection('Booster')).toBeNull();
    expect(suggestBrandCorrection('Krem')).toBeNull();
  });

  it('suggests the dictionary form for a Belarusian-spelled Cyrillic brand (і/ў folding)', () => {
    // Belarusian packaging: "Вітэкс" (with і, U+0456) vs the dictionary's
    // Russian form "Витэкс". Folded for comparison only — the suggestion is
    // still offered, not silently treated as identical.
    expect(suggestBrandCorrection('Вітэкс')).toBe('Витэкс');
  });
});
