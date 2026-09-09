/**
 * Detects whether an ingredient-list photo likely cut off part of the label
 * (round jars wrap the INCI text around a cylinder; tall/long packaging
 * needs more vertical space than one frame gives at a legible distance).
 * docs/investigations/ocr-incomplete-ingredient-capture.md.
 *
 * Deliberately conservative: a real device-QA round (see the investigation
 * doc §7) is needed before touching these thresholds, so this only flags the
 * two signals defensible from geometry alone — everything else (baseline
 * curvature) was left out rather than shipped unvalidated.
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */
import { extractIngredientSection } from '@/utils/productProfile/ingredientSectionExtractor';
import type { OcrLineData } from './ocrNoiseFilter';

export interface CaptureCompletenessInput {
  /** Raw (unfiltered) Tesseract line/word geometry — a word cut mid-character
   *  at the frame edge is often low-confidence and would be dropped by
   *  `filterOcrNoise`, which is exactly the word this check needs to see. */
  lines: OcrLineData[] | null;
  /** Pixel dimensions of the image Tesseract actually recognized (after any
   *  downscale), so "near the edge" can be measured relative to the frame. */
  imageWidth: number | null;
  imageHeight: number | null;
  /** The cleaned/recognized text, used only to check for a known section-end
   *  marker (Directions/Warnings/…) that overrides every geometry signal. */
  text: string;
}

export interface CaptureCompletenessResult {
  looksTruncated: boolean;
  reasons: string[];
}

/** How close a word's edge must be to the frame boundary to count as
 *  "touching" it, as a fraction of that dimension. Ratio-based rather than a
 *  fixed pixel count so it holds regardless of the WebView's downscale target. */
const EDGE_MARGIN_RATIO = 0.015;

/** Fraction of lines that must end flush with the right edge before it's
 *  trusted as "the frame consistently cut every line at the same point" —
 *  the wraparound-jar signature — rather than one coincidental line. */
const MIN_EDGE_LINE_RATIO = 0.4;

const OPENING_MARKER_REGEX = /^\s*(ingredients|inci)\b/i;

function hasKnownSectionEnd(text: string): boolean {
  return extractIngredientSection(text) !== text;
}

function startsWithKnownOpening(text: string): boolean {
  return OPENING_MARKER_REGEX.test(text);
}

/**
 * Flags a possibly-incomplete ingredient photo. Any known section-end marker
 * (Directions/Warnings/Made in/…) is treated as proof the shot reached a
 * real boundary and short-circuits every geometry signal — under-flagging
 * (missing a real cutoff) is preferred over telling a user their complete,
 * correctly-photographed label "looks cut off".
 *
 * Currently unwired (see docs/investigations/ocr-incomplete-ingredient-
 * capture.md §6a — the whole approach needs rethinking, not just
 * recalibration, before this is revived). Known gap for whoever picks this
 * back up: the edge/leading/trailing-word lookups below (`words[0]`,
 * `words[words.length - 1]`, `linesWithWords[0]`, `[...length - 1]`) assume
 * each line's words are already left-to-right and `lines` is already
 * top-to-bottom, with no sort or verification. That is exactly the
 * assumption most likely to break on the curved/wraparound-jar case this
 * module was built for, where Tesseract's own word/line ordering is more
 * likely to deviate from strict reading order than on a flat label.
 */
export function detectPossibleTruncation(
  input: CaptureCompletenessInput,
): CaptureCompletenessResult {
  if (!input.text.trim()) return { looksTruncated: false, reasons: [] };
  if (hasKnownSectionEnd(input.text)) return { looksTruncated: false, reasons: [] };

  const { lines, imageWidth, imageHeight } = input;
  if (!lines || lines.length === 0 || !imageWidth || !imageHeight) {
    return { looksTruncated: false, reasons: [] };
  }

  const reasons: string[] = [];
  const marginX = imageWidth * EDGE_MARGIN_RATIO;
  const marginY = imageHeight * EDGE_MARGIN_RATIO;

  const linesWithWords = lines.filter((line) => line.words.length > 0);

  if (linesWithWords.length >= 2) {
    const rightEdgeLineCount = linesWithWords.filter((line) => {
      const lastWord = line.words[line.words.length - 1];
      return imageWidth - lastWord.x1 <= marginX;
    }).length;
    if (rightEdgeLineCount / linesWithWords.length >= MIN_EDGE_LINE_RATIO) {
      reasons.push('multiple-lines-cut-at-right-edge');
    }
  }

  const lastLine = linesWithWords[linesWithWords.length - 1];
  if (lastLine) {
    const lastWord = lastLine.words[lastLine.words.length - 1];
    if (imageHeight - lastWord.y1 <= marginY) {
      reasons.push('trailing-word-touches-bottom-edge');
    }
  }

  const firstLine = linesWithWords[0];
  if (firstLine && !startsWithKnownOpening(input.text)) {
    const firstWord = firstLine.words[0];
    if (firstWord.x0 <= marginX) {
      reasons.push('leading-word-touches-left-edge');
    }
    if (firstWord.y0 <= marginY) {
      reasons.push('leading-word-touches-top-edge');
    }
  }

  return { looksTruncated: reasons.length > 0, reasons };
}
