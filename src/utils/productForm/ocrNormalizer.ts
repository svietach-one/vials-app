/**
 * Splits raw label-OCR text into a brand / product-name guess.
 * Heuristic: first non-empty line = brand, remaining lines = name.
 * Both fields stay user-editable after the result lands, so an imperfect
 * split is low-cost — keep this simple.
 */
export function splitLabelText(rawText: string): { brand: string; name: string } {
  const lines = rawText
    .replace(/[©®ⓡ™]/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return { brand: '', name: '' };

  const [brand, ...rest] = lines;
  return { brand, name: rest.join(' ') };
}
