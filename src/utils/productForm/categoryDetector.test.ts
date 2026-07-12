import { detectCategory } from './categoryDetector';

describe('detectCategory', () => {
  it('detects serum', () => {
    expect(detectCategory('Niacinamide 10% Serum')).toBe('serum');
  });

  it('detects moisturizer from cream and moisturising wording', () => {
    expect(detectCategory('Daily Moisturising Lotion')).toBe('moisturizer');
    expect(detectCategory('Rich Night Cream')).toBe('moisturizer');
  });

  it('detects cleanser including wash and cleanzer spellings', () => {
    expect(detectCategory('Foaming Facial Cleanser')).toBe('cleanser');
    expect(detectCategory('Gentle Face Wash')).toBe('cleanser');
    expect(detectCategory('Micellar Cleanzer')).toBe('cleanser');
  });

  it('detects toner including tonic wording', () => {
    expect(detectCategory('Exfoliating Glow Toner')).toBe('toner');
    expect(detectCategory('Hydrating Facial Tonic')).toBe('toner');
  });

  it('detects spf from SPF rating and sunscreen wording', () => {
    expect(detectCategory('UV Fluid SPF 50+')).toBe('spf');
    expect(detectCategory('Mineral Sunscreen Fluid')).toBe('spf');
    expect(detectCategory('Invisible Sun Screen Stick')).toBe('spf');
  });

  it('detects mask', () => {
    expect(detectCategory('Overnight Sleeping Mask')).toBe('mask');
  });

  it('detects oil', () => {
    expect(detectCategory('Rosehip Facial Oil')).toBe('oil');
  });

  it('detects peeling from exfoliant, peeling and scrub wording', () => {
    expect(detectCategory('AHA 30% Exfoliant Solution')).toBe('peeling');
    expect(detectCategory('Enzyme Peeling Gel')).toBe('peeling');
    expect(detectCategory('Walnut Face Scrub')).toBe('peeling');
  });

  it('returns null when no pattern matches', () => {
    expect(detectCategory('Aqua Essence Booster')).toBeNull();
  });

  it('resolves ambiguous labels by first match wins', () => {
    // 'serum' pattern precedes 'spf' in CATEGORY_PATTERNS.
    expect(detectCategory('Sunscreen Serum SPF 30')).toBe('serum');
  });
});
