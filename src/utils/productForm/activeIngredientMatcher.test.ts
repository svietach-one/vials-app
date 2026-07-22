import { parseInciText } from './activeIngredientMatcher';

describe('parseInciText', () => {
  it('matches canonical actives in a Latin INCI list', () => {
    const keys = parseInciText(
      'Aqua, Glycerin, Niacinamide, Retinol, Salicylic Acid, Glycolic Acid',
    );

    // glycerin_class since phase-03: glycerin at position 2 clears the
    // requireWithinPosition gate — in a concentration-ordered list that IS a
    // top humectant, exactly what the gate exists to distinguish.
    expect(keys).toEqual(
      expect.arrayContaining(['niacinamide', 'retinoid', 'bha', 'aha', 'glycerin_class']),
    );
    expect(keys).toHaveLength(5);
  });

  it('classifies ethyl ascorbic acid as a derivative, not pure vitamin C', () => {
    const keys = parseInciText('Aqua, 3-O-Ethyl Ascorbic Acid, Phenoxyethanol');

    expect(keys).toContain('vitamin_c_derivative');
    expect(keys).not.toContain('vitamin_c_pure');
  });

  it('classifies plain ascorbic acid as pure vitamin C', () => {
    const keys = parseInciText('Aqua, Ascorbic Acid, Tocopherol');

    expect(keys).toContain('vitamin_c_pure');
  });

  it('returns no keys for each ingredient key appearing more than once', () => {
    const keys = parseInciText('Retinol, Retinyl Palmitate, Tretinoin');

    expect(keys).toEqual(['retinoid']);
  });

  it('returns empty array for translated non-Latin ingredient text (expected, enforced by the INCI notice)', () => {
    // Korean label text
    expect(parseInciText('정제수, 나이아신아마이드, 레티놀')).toEqual([]);
    // Polish translated sticker
    expect(parseInciText('woda, kwas salicylowy, gliceryna')).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(parseInciText('')).toEqual([]);
  });
});
