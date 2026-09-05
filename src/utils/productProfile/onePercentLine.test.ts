import { findOnePercentLine } from '@/utils/productProfile/onePercentLine';

/** A realistic ~40-ingredient moisturiser list, phenoxyethanol near the end. */
const MOISTURISER_INCI = [
  'Aqua',
  'Glycerin',
  'Caprylic/Capric Triglyceride',
  'Cetearyl Alcohol',
  'Dimethicone',
  'Niacinamide',
  'Ceramide NP',
  'Ceramide AP',
  'Ceramide EOP',
  'Cholesterol',
  'Petrolatum',
  'Butyrospermum Parkii Butter',
  'Squalane',
  'Glyceryl Stearate',
  'PEG-100 Stearate',
  'Behentrimonium Methosulfate',
  'Sodium Hyaluronate',
  'Panthenol',
  'Tocopheryl Acetate',
  'Acrylates Copolymer',
  'Dimethicone Crosspolymer',
  'Polysorbate 20',
  'Cetyl Alcohol',
  'Phenoxyethanol',
  'Xanthan Gum',
  'Sodium Chloride',
  'Disodium EDTA',
  'Citric Acid',
  'Ethylhexylglycerin',
  'Fragrance',
  'Limonene',
  'Linalool',
  'Butylene Glycol',
  'Allantoin',
  'Bisabolol',
  'Sodium Hydroxide',
  'Caprylyl Glycol',
  'Hydroxyacetophenone',
  'Water',
  'Denatonium Benzoate',
];

/** A short oil serum — realistic, at the MIN_TOKENS floor, Tocopherol the sole marker. */
const OIL_SERUM_INCI = [
  'Squalane',
  'Argania Spinosa Kernel Oil',
  'Rosa Canina Fruit Oil',
  'Tocopherol',
  'Simmondsia Chinensis Seed Oil',
  'Helianthus Annuus Seed Oil',
];

/** A fragranced cream whose only marker is a fragrance allergen. */
const FRAGRANCED_CREAM_NO_HIGH_MARKER = [
  'Aqua',
  'Cetearyl Alcohol',
  'Glycerin',
  'Isopropyl Myristate',
  'Butyrospermum Parkii Butter',
  'Glyceryl Stearate',
  'Dimethicone',
  'Panthenol',
  'Allantoin',
  'Bisabolol',
  'Limonene',
  'Fragrance',
];

describe('findOnePercentLine — high confidence', () => {
  it('finds phenoxyethanol near the end of a realistic 40-ingredient list', () => {
    const result = findOnePercentLine(MOISTURISER_INCI);

    expect(result).not.toBeNull();
    expect(result?.confidence).toBe('high');
    expect(result?.markerToken).toBe('Phenoxyethanol');
    expect(result?.lineIndex).toBe(MOISTURISER_INCI.indexOf('Phenoxyethanol'));
  });

  it('prefers the high-confidence marker over an earlier medium-confidence one', () => {
    // Limonene sits well before Phenoxyethanol in MOISTURISER_INCI — the
    // high marker must still win, per the tier-before-position rule.
    const limoneneIndex = MOISTURISER_INCI.indexOf('Limonene');
    const phenoxyethanolIndex = MOISTURISER_INCI.indexOf('Phenoxyethanol');
    expect(limoneneIndex).toBeGreaterThan(phenoxyethanolIndex);

    // Build a list where a medium marker precedes the high marker, to
    // exercise the actual worked example from the task doc.
    const tokens = [...MOISTURISER_INCI];
    const reordered = [
      ...tokens.slice(0, phenoxyethanolIndex),
      'Coumarin', // medium marker, now earlier than Phenoxyethanol
      ...tokens.slice(phenoxyethanolIndex),
    ];

    const result = findOnePercentLine(reordered);

    expect(result?.confidence).toBe('high');
    expect(result?.markerToken).toBe('Phenoxyethanol');
    expect(result?.lineIndex).toBe(reordered.indexOf('Phenoxyethanol'));
  });

  it('does not match tocopheryl acetate, but does match tocopherol', () => {
    const result = findOnePercentLine(OIL_SERUM_INCI);
    expect(result?.confidence).toBe('high');
    expect(result?.markerToken).toBe('Tocopherol');

    // Tocopherol is the sole marker in this fixture — swapping it for the
    // acetate ester must leave no marker at all, i.e. null, not a fallback.
    const withAcetateOnly = OIL_SERUM_INCI.map((t) => (t === 'Tocopherol' ? 'Tocopheryl Acetate' : t));
    expect(findOnePercentLine(withAcetateOnly)).toBeNull();
  });
});

describe('findOnePercentLine — medium confidence', () => {
  it('returns medium confidence when the only marker is a fragrance allergen (limonene)', () => {
    const result = findOnePercentLine(FRAGRANCED_CREAM_NO_HIGH_MARKER);

    expect(result).not.toBeNull();
    expect(result?.confidence).toBe('medium');
    expect(result?.markerToken).toBe('Limonene');
    expect(result?.lineIndex).toBe(FRAGRANCED_CREAM_NO_HIGH_MARKER.indexOf('Limonene'));
  });
});

describe('findOnePercentLine — guards', () => {
  it('returns null for a list shorter than 6 tokens', () => {
    expect(findOnePercentLine(['Aqua', 'Glycerin', 'Phenoxyethanol', 'Limonene', 'Tocopherol'])).toBeNull();
  });

  it('returns null when the marker sits before index 3', () => {
    const tokens = ['Aqua', 'Phenoxyethanol', 'Glycerin', 'Niacinamide', 'Panthenol', 'Allantoin'];
    expect(findOnePercentLine(tokens)).toBeNull();
  });

  it('returns null when the marker is the final token', () => {
    const tokens = ['Aqua', 'Glycerin', 'Niacinamide', 'Panthenol', 'Allantoin', 'Phenoxyethanol'];
    expect(findOnePercentLine(tokens)).toBeNull();
  });

  it('returns null when no marker is present at all', () => {
    const tokens = ['Aqua', 'Glycerin', 'Niacinamide', 'Panthenol', 'Allantoin', 'Squalane'];
    expect(findOnePercentLine(tokens)).toBeNull();
  });

  it('returns null for an empty array without throwing', () => {
    expect(findOnePercentLine([])).toBeNull();
  });

  it('returns null for a single-element array without throwing', () => {
    expect(findOnePercentLine(['Aqua'])).toBeNull();
  });
});
