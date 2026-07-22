import { getProductThumbnailTint } from '@/utils/productThumbnailTint';

/**
 * Unit tests — placeholder wash (img-02). The wash must be a low-alpha rgba
 * (never a full-value fill), grouped by type family, with a neutral fallback.
 */
describe('getProductThumbnailTint', () => {
  it('returns a low-alpha rgba wash for a known type', () => {
    const wash = getProductThumbnailTint('serum');
    expect(wash).toMatch(/^rgba\(/);
    const alpha = Number(wash.match(/,\s*([\d.]+)\)$/)?.[1]);
    // Below any semantic-tint saturation — reads as a neutral surface, not a fill.
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(0.15);
  });

  it('maps same-family product types to the same wash', () => {
    expect(getProductThumbnailTint('serum')).toBe(getProductThumbnailTint('essence'));
    expect(getProductThumbnailTint('cleanser')).toBe(getProductThumbnailTint('moisturizer'));
  });

  it('gives different families different washes', () => {
    expect(getProductThumbnailTint('serum')).not.toBe(getProductThumbnailTint('cleanser'));
  });

  it('falls back to a neutral wash for a type outside the accent map', () => {
    expect(getProductThumbnailTint('other')).toMatch(/^rgba\(/);
  });
});
