import { filterOcrNoise, WORD_CONFIDENCE_FLOOR } from './ocrNoiseFilter';
import type { OcrLineData, OcrWordData } from './ocrNoiseFilter';

/** Word factory: geometry defaults to a 20px-tall word at x0=0 so tests only
 *  spell out the dimension they exercise. */
function makeWord(text: string, overrides: Partial<OcrWordData> = {}): OcrWordData {
  return { text, confidence: 90, x0: 0, y0: 0, x1: 50, y1: 20, ...overrides };
}

function makeLine(...words: OcrWordData[]): OcrLineData {
  return { words };
}

describe('filterOcrNoise', () => {
  it('keeps confident words and preserves line structure', () => {
    const lines = [
      makeLine(makeWord('Bioderma')),
      makeLine(makeWord('Sensibio'), makeWord('H2O')),
    ];

    expect(filterOcrNoise(lines)).toBe('Bioderma\nSensibio H2O');
  });

  it('drops words below the confidence floor', () => {
    const lines = [
      makeLine(
        makeWord('Bioderma'),
        makeWord('#$@!x', { confidence: WORD_CONFIDENCE_FLOOR - 1 }),
      ),
    ];

    expect(filterOcrNoise(lines)).toBe('Bioderma');
  });

  it('keeps words exactly at the confidence floor', () => {
    const lines = [makeLine(makeWord('Serum', { confidence: WORD_CONFIDENCE_FLOOR }))];

    expect(filterOcrNoise(lines)).toBe('Serum');
  });

  it('drops punctuation-only tokens regardless of confidence', () => {
    const lines = [makeLine(makeWord('Vichy'), makeWord('®™', { confidence: 99 }))];

    expect(filterOcrNoise(lines)).toBe('Vichy');
  });

  it('keeps Cyrillic and accented words (letter check is not ASCII-only)', () => {
    const lines = [makeLine(makeWord('Белита')), makeLine(makeWord('Avène'))];

    expect(filterOcrNoise(lines)).toBe('Белита\nAvène');
  });

  it('drops words far smaller than the dominant text height', () => {
    const lines = [
      makeLine(
        makeWord('La'),
        makeWord('Roche'),
        makeWord('Posay'),
        makeWord('Effaclar'),
      ),
      // Background shelf text: 4px tall vs the 20px median.
      makeLine(makeWord('shelftag', { y0: 0, y1: 4 })),
    ];

    expect(filterOcrNoise(lines)).toBe('La Roche Posay Effaclar');
  });

  it('does not apply the height filter when few words survive', () => {
    const lines = [
      makeLine(makeWord('Ziaja'), makeWord('krem')),
      makeLine(makeWord('50ml', { y0: 0, y1: 4 })),
    ];

    expect(filterOcrNoise(lines)).toBe('Ziaja krem\n50ml');
  });

  it('drops single-letter tokens (shredded stylized-font debris)', () => {
    const lines = [
      makeLine(makeWord('t', { confidence: 69 }), makeWord('Peel')),
      makeLine(makeWord('J'), makeWord('a')),
    ];

    expect(filterOcrNoise(lines)).toBe('Peel');
  });

  it('keeps single-digit tokens (product-name numerals, PAO fragments)', () => {
    const lines = [makeLine(makeWord('4'), makeWord('Orange'))];

    expect(filterOcrNoise(lines)).toBe('4 Orange');
  });

  it('removes lines whose every word was dropped', () => {
    const lines = [
      makeLine(makeWord('|||', { confidence: 20 })),
      makeLine(makeWord('Nuxe')),
    ];

    expect(filterOcrNoise(lines)).toBe('Nuxe');
  });

  it('returns empty string when every word is noise', () => {
    const lines = [
      makeLine(makeWord('~~', { confidence: 95 }), makeWord('xj3', { confidence: 12 })),
    ];

    expect(filterOcrNoise(lines)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(filterOcrNoise([])).toBe('');
  });
});
