/**
 * Confidence/geometry noise filter for raw Tesseract output — the downstream
 * half of dropping the system crop step (spec §6.1: full-frame photos carry
 * shelf/background junk that must be discarded before any fuzzy matching).
 * Pure function: the OCR engine component feeds it the per-line word data
 * Tesseract already produces and forwards only the surviving text.
 */

/** One recognized word, in the source image's pixel coordinates. */
export interface OcrWordData {
  text: string;
  /** Tesseract word confidence, 0–100. */
  confidence: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** One recognized line: Tesseract's own line grouping, kept intact so the
 *  filtered output preserves the \n structure splitLabelLines depends on. */
export interface OcrLineData {
  words: OcrWordData[];
}

/**
 * Words below this confidence are discarded. Tesseract scores legible print
 * in the 80–95 range; glare fragments, background objects, and icon misreads
 * typically land well under 60.
 */
export const WORD_CONFIDENCE_FLOOR = 60;

/**
 * A word whose height is under this fraction of the median surviving word
 * height is treated as background text (another product on the shelf, far
 * behind the packaging being scanned). Conservative on purpose: label
 * sub-lines are smaller than the brand name but nowhere near 3× smaller.
 */
const MIN_HEIGHT_RATIO = 0.3;

/** Below this many surviving words the height median is too unstable to
 *  trust (a 3-word label shot must not filter itself), so skip that pass. */
const MIN_WORDS_FOR_HEIGHT_FILTER = 4;

/** Any letter or digit in any script — bare punctuation runs are icon or
 *  certification-mark misreads (spec §6.1), not text worth keeping. */
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Rebuilds the recognized text keeping only words that (a) clear the
 * confidence floor, (b) contain at least one letter or digit, and (c) are not
 * drastically smaller than the dominant text size. Line structure survives;
 * lines whose every word was dropped disappear. An empty result means the
 * scan was all noise — callers already treat empty OCR text as "try again /
 * manual entry", which is exactly the right routing for a garbage scan.
 */
export function filterOcrNoise(lines: OcrLineData[]): string {
  const confidentLines = lines.map((line) =>
    line.words.filter(
      (word) =>
        word.confidence >= WORD_CONFIDENCE_FLOOR && HAS_LETTER_OR_DIGIT.test(word.text),
    ),
  );

  const survivors = confidentLines.flat();
  let minHeight = 0;
  if (survivors.length >= MIN_WORDS_FOR_HEIGHT_FILTER) {
    minHeight = median(survivors.map((word) => word.y1 - word.y0)) * MIN_HEIGHT_RATIO;
  }

  return confidentLines
    .map((words) =>
      words
        .filter((word) => word.y1 - word.y0 >= minHeight)
        .map((word) => word.text.trim())
        .filter((text) => text.length > 0)
        .join(' '),
    )
    .filter((line) => line.length > 0)
    .join('\n');
}
