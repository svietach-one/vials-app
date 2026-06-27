export interface OcrCleanResult {
  cleanedText: string;
  hadNonLatin: boolean;
}

/**
 * Normalises raw OCR or clipboard text into a clean INCI string.
 * Returns the cleaned text and a flag indicating whether significant
 * non-Latin characters were stripped (>30 % of alphabetical chars).
 */
export function ocrTextCleaner(raw: string): OcrCleanResult {
  if (!raw.trim()) return { cleanedText: '', hadNonLatin: false };

  // Step 1 — flatten line/tab breaks into comma separators
  let text = raw.replace(/[\r\n\t]+/g, ', ');

  // Step 2 — collapse repeated commas and whitespace
  text = text.replace(/,\s*,+/g, ',').replace(/\s{2,}/g, ' ');

  // Step 3 — measure non-Latin ratio before stripping
  // Alphabetical chars include basic Latin + extended Latin (accented letters, e.g. è, ü)
  const totalAlpha = (text.match(/[A-Za-zÀ-￿]/g) ?? []).length;
  // Non-Latin: anything beyond extended Latin (CJK, Arabic, Cyrillic, etc.)
  const nonLatin = (text.match(/[ɐ-￿]/g) ?? []).length;
  const hadNonLatin = totalAlpha > 0 && nonLatin / totalAlpha > 0.3;

  // Step 4 — strip characters that are not valid in INCI ingredient strings
  // Keep: A–Z a–z 0–9 space comma period parens hyphen slash plus percent
  text = text.replace(/[^A-Za-z0-9 ,.()\-/+%]/g, '');

  // Step 5 — final normalisation pass
  text = text
    .replace(/,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim();

  return { cleanedText: text, hadNonLatin };
}
