import { detectPossibleTruncation } from './ocrCaptureCompleteness';
import type { OcrLineData, OcrWordData } from './ocrNoiseFilter';

const IMAGE_WIDTH = 1000;
const IMAGE_HEIGHT = 800;

/** Word factory: a comfortably-interior word by default (far from every
 *  edge) so tests only spell out the coordinate they're exercising. */
function makeWord(text: string, overrides: Partial<OcrWordData> = {}): OcrWordData {
  return { text, confidence: 90, x0: 400, y0: 400, x1: 450, y1: 420, ...overrides };
}

function makeLine(...words: OcrWordData[]): OcrLineData {
  return { words };
}

describe('detectPossibleTruncation', () => {
  it('returns not-truncated for empty text', () => {
    const result = detectPossibleTruncation({
      lines: null,
      imageWidth: null,
      imageHeight: null,
      text: '',
    });

    expect(result).toEqual({ looksTruncated: false, reasons: [] });
  });

  it('returns not-truncated when no line/image geometry is available', () => {
    const result = detectPossibleTruncation({
      lines: null,
      imageWidth: null,
      imageHeight: null,
      text: 'Aqua, Glycerin, Niacinamide',
    });

    expect(result).toEqual({ looksTruncated: false, reasons: [] });
  });

  it('trusts a known section-end marker over any geometry signal', () => {
    const lines = [
      makeLine(makeWord('Aqua')),
      // Every line ends flush with the right edge, which would otherwise flag
      // truncation — but the text reached "Directions", a real boundary.
      makeLine(makeWord('Glycerin', { x1: IMAGE_WIDTH })),
      makeLine(makeWord('Niacinamide', { x1: IMAGE_WIDTH })),
    ];

    const result = detectPossibleTruncation({
      lines,
      imageWidth: IMAGE_WIDTH,
      imageHeight: IMAGE_HEIGHT,
      text: 'Aqua, Glycerin, Niacinamide. Directions: apply daily.',
    });

    expect(result).toEqual({ looksTruncated: false, reasons: [] });
  });

  it('flags truncation when most lines end flush with the right edge', () => {
    const lines = [
      makeLine(makeWord('Aqua', { x1: IMAGE_WIDTH - 2 })),
      makeLine(makeWord('Glycerin', { x1: IMAGE_WIDTH - 1 })),
      makeLine(makeWord('Niacinamide', { x1: IMAGE_WIDTH })),
    ];

    const result = detectPossibleTruncation({
      lines,
      imageWidth: IMAGE_WIDTH,
      imageHeight: IMAGE_HEIGHT,
      text: 'Aqua, Glycerin, Niacinamide',
    });

    expect(result.looksTruncated).toBe(true);
    expect(result.reasons).toContain('multiple-lines-cut-at-right-edge');
  });

  it('does not flag a single coincidental line ending near the edge', () => {
    const lines = [
      makeLine(makeWord('Aqua')),
      makeLine(makeWord('Glycerin')),
      makeLine(makeWord('Niacinamide', { x1: IMAGE_WIDTH })),
    ];

    const result = detectPossibleTruncation({
      lines,
      imageWidth: IMAGE_WIDTH,
      imageHeight: IMAGE_HEIGHT,
      text: 'Aqua, Glycerin, Niacinamide',
    });

    expect(result.looksTruncated).toBe(false);
  });

  it('flags truncation when the last word touches the bottom edge', () => {
    const lines = [
      makeLine(makeWord('Aqua')),
      makeLine(makeWord('Glycerin', { y1: IMAGE_HEIGHT })),
    ];

    const result = detectPossibleTruncation({
      lines,
      imageWidth: IMAGE_WIDTH,
      imageHeight: IMAGE_HEIGHT,
      text: 'Aqua, Glycerin',
    });

    expect(result.looksTruncated).toBe(true);
    expect(result.reasons).toContain('trailing-word-touches-bottom-edge');
  });

  it('flags truncation when the list appears to start mid-frame with no opening marker', () => {
    const lines = [
      makeLine(makeWord('Niacinamide', { x0: 0 })),
      makeLine(makeWord('Glycerin')),
    ];

    const result = detectPossibleTruncation({
      lines,
      imageWidth: IMAGE_WIDTH,
      imageHeight: IMAGE_HEIGHT,
      text: 'Niacinamide, Glycerin',
    });

    expect(result.looksTruncated).toBe(true);
    expect(result.reasons).toContain('leading-word-touches-left-edge');
  });

  it('does not flag a left-edge start when the text has a known opening marker', () => {
    const lines = [
      makeLine(makeWord('Ingredients', { x0: 0 })),
      makeLine(makeWord('Glycerin')),
    ];

    const result = detectPossibleTruncation({
      lines,
      imageWidth: IMAGE_WIDTH,
      imageHeight: IMAGE_HEIGHT,
      text: 'Ingredients: Aqua, Glycerin',
    });

    expect(result.looksTruncated).toBe(false);
  });

  it('returns not-truncated for a normal, fully-framed capture', () => {
    const lines = [
      makeLine(makeWord('Aqua')),
      makeLine(makeWord('Glycerin')),
      makeLine(makeWord('Niacinamide')),
    ];

    const result = detectPossibleTruncation({
      lines,
      imageWidth: IMAGE_WIDTH,
      imageHeight: IMAGE_HEIGHT,
      text: 'Aqua, Glycerin, Niacinamide',
    });

    expect(result).toEqual({ looksTruncated: false, reasons: [] });
  });
});
