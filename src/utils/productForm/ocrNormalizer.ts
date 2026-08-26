import type { ProductQuery } from '@/services/corpus/types';

/**
 * Splits raw label-OCR text into cleaned display lines for the
 * line-assignment chip pool. Deliberately NOT run through ocrTextCleaner:
 * that helper flattens newlines into commas (built for INCI strings) and
 * strips accented Latin letters that are common in brand names ("Avène").
 * Here we only normalise whitespace and drop trademark glyphs, keeping
 * the line structure Tesseract detected.
 */
export function splitLabelLines(rawText: string): string[] {
  return rawText
    .replace(/[©®ⓡ™]/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

/**
 * Splits raw label-OCR text into a brand / product-name guess.
 * Heuristic: first non-empty line = brand, remaining lines = name.
 * Both fields stay user-editable after the result lands, so an imperfect
 * split is low-cost — keep this simple.
 */
export function splitLabelText(rawText: string): { brand: string; name: string } {
  const lines = splitLabelLines(rawText);

  if (lines.length === 0) return { brand: '', name: '' };

  const [brand, ...rest] = lines;
  return { brand, name: rest.join(' ') };
}

/**
 * Builds the structured corpus query for an OCR label capture
 * (docs/tasks/ocr_improvement/02-segment-ocr-query.md). Wraps
 * {@link splitLabelText} and guards against the degenerate single-line case:
 * if the split produces no `name` (e.g. a label photo with only a brand
 * line), fall back to using `brand` as `name` and drop `brand` — the corpus
 * query must never carry an empty `name`, and a query must never reach
 * {@link ProductRepository.search} with an empty trimmed value composed from
 * a non-empty `raw` input.
 */
export function buildOcrProductQuery(rawText: string): ProductQuery {
  const { brand, name } = splitLabelText(rawText);

  if (!name) {
    return { name: brand, origin: 'ocr', raw: rawText };
  }
  return { brand, name, origin: 'ocr', raw: rawText };
}
