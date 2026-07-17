import type { Product } from '@/types';
import { buildProductFacts, buildShelfFacts } from '@/utils/routineEngine/productFacts';

const NOW = new Date('2026-07-04T12:00:00Z');

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Test Serum',
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

const classKeys = (facts: ReturnType<typeof buildProductFacts>) =>
  facts.classes.map((c) => c.key);

describe('buildProductFacts — class attribution', () => {
  it('attributes wizard-confirmed activeTags as tag-sourced classes', () => {
    const facts = buildProductFacts(makeProduct({ activeTags: ['retinoid'] }), NOW);
    expect(facts.classes).toEqual([
      { key: 'retinoid', source: 'tag', potency: 'high' },
    ]);
  });

  it('normalizes legacy tag keys before attribution', () => {
    const facts = buildProductFacts(makeProduct({ activeTags: ['retinol'] }), NOW);
    expect(classKeys(facts)).toEqual(['retinoid']);
  });

  it('fills gaps from the INCI parse as parse-sourced classes', () => {
    const facts = buildProductFacts(
      makeProduct({
        activeTags: ['niacinamide'],
        fullIngredientText: 'Aqua, Niacinamide, Glycolic Acid, Glycerin',
      }),
      NOW,
    );
    expect(facts.classes).toEqual([
      { key: 'aha', source: 'parse', potency: 'high' },
      { key: 'niacinamide', source: 'tag', potency: 'medium' },
    ]);
  });

  it('keeps the tag as the source when the parse confirms the same class', () => {
    const facts = buildProductFacts(
      makeProduct({ activeTags: ['retinoid'], fullIngredientText: 'Aqua, Retinol' }),
      NOW,
    );
    expect(facts.classes).toEqual([
      { key: 'retinoid', source: 'tag', potency: 'high' },
    ]);
  });

  it('merges activeIngredients keys into the tag-sourced set', () => {
    const facts = buildProductFacts(
      makeProduct({ activeIngredients: [{ key: 'vitamin_c', displayName: 'Vitamin C' }] }),
      NOW,
    );
    expect(facts.classes).toEqual([
      expect.objectContaining({ key: 'vitamin_c_pure', source: 'tag' }),
    ]);
  });

  it('returns classes sorted by key for stable output', () => {
    const facts = buildProductFacts(
      makeProduct({ activeTags: ['niacinamide', 'aha', 'cica'] }),
      NOW,
    );
    expect(classKeys(facts)).toEqual(['aha', 'cica', 'niacinamide']);
  });
});

describe('buildProductFacts — potency', () => {
  it('uses INCI-evidenced potency for a tagged class (retinyl palmitate → low)', () => {
    const facts = buildProductFacts(
      makeProduct({
        activeTags: ['retinoid'],
        fullIngredientText: 'Aqua, Retinyl Palmitate, Glycerin',
      }),
      NOW,
    );
    expect(facts.classes[0].potency).toBe('low');
  });

  it('takes the strongest potency when several forms of one class are present', () => {
    const facts = buildProductFacts(
      makeProduct({ fullIngredientText: 'Retinyl Palmitate, Retinol' }),
      NOW,
    );
    expect(facts.classes[0]).toEqual({ key: 'retinoid', source: 'parse', potency: 'high' });
  });

  it('defaults a tag-only class with no INCI evidence to high potency', () => {
    const facts = buildProductFacts(makeProduct({ activeTags: ['aha'] }), NOW);
    expect(facts.classes[0].potency).toBe('high');
  });

  it('leaves potency undefined for classes whose matchers declare none', () => {
    const facts = buildProductFacts(makeProduct({ activeTags: ['ceramides'] }), NOW);
    expect(facts.classes[0].potency).toBeUndefined();
  });
});

describe('buildProductFacts — INCI false positives (research §1.6)', () => {
  it('does not attribute retinoid from a "retinol-free" claim', () => {
    const facts = buildProductFacts(
      makeProduct({ fullIngredientText: 'Aqua, Glycerin (retinol-free formula)' }),
      NOW,
    );
    expect(classKeys(facts)).not.toContain('retinoid');
  });

  it('does not attribute AHA from sodium lactate', () => {
    const facts = buildProductFacts(
      makeProduct({ fullIngredientText: 'Aqua, Sodium Lactate, Glycerin' }),
      NOW,
    );
    expect(classKeys(facts)).not.toContain('aha');
  });

  it('classifies ethyl ascorbic acid as derivative, not pure vitamin C', () => {
    const facts = buildProductFacts(
      makeProduct({ fullIngredientText: 'Aqua, Ethyl Ascorbic Acid' }),
      NOW,
    );
    expect(classKeys(facts)).toContain('vitamin_c_derivative');
    expect(classKeys(facts)).not.toContain('vitamin_c_pure');
  });

  it('attributes willow bark to BHA at low potency, not high', () => {
    const facts = buildProductFacts(
      makeProduct({ fullIngredientText: 'Aqua, Willow Bark Extract' }),
      NOW,
    );
    expect(facts.classes[0]).toEqual({ key: 'bha', source: 'parse', potency: 'low' });
  });
});

describe('buildProductFacts — aggregated properties', () => {
  it('OR-merges booleans and takes max irritancy across classes', () => {
    // retinoid: photosensitizing, irr 4 at the tagged 'high' potency default;
    // ceramides: barrierRepair, irr 0
    const facts = buildProductFacts(
      makeProduct({ activeTags: ['retinoid', 'ceramides'] }),
      NOW,
    );
    expect(facts.properties).toEqual({
      photosensitizing: true,
      exfoliating: false,
      irritancy: 4,
      barrierRepair: true,
      lowPh: false,
      spf: false,
      massageRequired: false,
    });
  });

  it('reports zeroed properties for a product with no known actives', () => {
    const facts = buildProductFacts(makeProduct(), NOW);
    expect(facts.properties.irritancy).toBe(0);
    expect(facts.properties.photosensitizing).toBe(false);
    expect(facts.classes).toHaveLength(0);
  });
});

describe('buildProductFacts — allowed periods', () => {
  it('intersects class periods with usageTime (retinoid pm-only ∩ both → pm)', () => {
    const facts = buildProductFacts(
      makeProduct({ activeTags: ['retinoid'], usageTime: 'both' }),
      NOW,
    );
    expect(facts.allowedPeriods).toEqual(['pm']);
  });

  it('yields an empty intersection for a pm-only active on a morning product', () => {
    const facts = buildProductFacts(
      makeProduct({ activeTags: ['retinoid'], usageTime: 'morning' }),
      NOW,
    );
    expect(facts.allowedPeriods).toEqual([]);
  });

  it('restricts spf filters to am', () => {
    const facts = buildProductFacts(
      makeProduct({ activeTags: ['spf_filters'], usageTime: 'both' }),
      NOW,
    );
    expect(facts.allowedPeriods).toEqual(['am']);
  });

  it('follows usageTime alone when the product has no actives', () => {
    const facts = buildProductFacts(makeProduct({ usageTime: 'evening' }), NOW);
    expect(facts.allowedPeriods).toEqual(['pm']);
  });
});

describe('buildProductFacts — eligibility', () => {
  it('marks a hidden product ineligible', () => {
    const facts = buildProductFacts(makeProduct({ isHidden: true }), NOW);
    expect(facts.eligible).toBe(false);
  });

  it('marks a PAO-expired product ineligible', () => {
    // Opened 2025-01-01 with 6-month PAO → expired long before NOW
    const facts = buildProductFacts(
      makeProduct({ openedDate: '2025-01-01', paoMonths: 6 }),
      NOW,
    );
    expect(facts.eligible).toBe(false);
  });

  it('keeps a product within its PAO window eligible', () => {
    const facts = buildProductFacts(
      makeProduct({ openedDate: '2026-06-01', paoMonths: 6 }),
      NOW,
    );
    expect(facts.eligible).toBe(true);
  });

  it('treats missing PAO data as never expired', () => {
    const facts = buildProductFacts(makeProduct({ openedDate: null, paoMonths: null }), NOW);
    expect(facts.eligible).toBe(true);
  });
});

describe('buildProductFacts — determinism', () => {
  it('produces an identical record for the same product and date', () => {
    const product = makeProduct({
      activeTags: ['retinoid', 'niacinamide'],
      fullIngredientText: 'Aqua, Retinol, Niacinamide, Salicylic Acid',
    });
    expect(buildProductFacts(product, NOW)).toEqual(buildProductFacts(product, NOW));
  });
});

describe('buildShelfFacts', () => {
  it('keys facts by productId preserving shelf order', () => {
    const shelf = [makeProduct({ id: 'a' }), makeProduct({ id: 'b' })];
    const facts = buildShelfFacts(shelf, NOW);
    expect([...facts.keys()]).toEqual(['a', 'b']);
    expect(facts.get('a')?.productId).toBe('a');
  });
});

describe('buildProductFacts — peptide subclasses (spec phase-01 §1.3)', () => {
  it('attributes Matrixyl to peptide_signal, not copper_peptides', () => {
    // The whole point of the subclass split: a signal peptide must be visible
    // to goal matching without inheriting copper peptides' acid/vitC conflicts.
    const facts = buildProductFacts(
      makeProduct({ fullIngredientText: 'Aqua, Palmitoyl Pentapeptide-4, Glycerin' }),
      NOW,
    );
    expect(classKeys(facts)).toEqual(['peptide_signal']);
  });

  it('attributes the Matrixyl trade name to peptide_signal', () => {
    const facts = buildProductFacts(
      makeProduct({ fullIngredientText: 'Aqua, Matrixyl 3000, Glycerin' }),
      NOW,
    );
    expect(classKeys(facts)).toEqual(['peptide_signal']);
  });

  it('attributes Argireline to peptide_neuro', () => {
    const facts = buildProductFacts(
      makeProduct({ fullIngredientText: 'Aqua, Acetyl Hexapeptide-8, Glycerin' }),
      NOW,
    );
    expect(classKeys(facts)).toEqual(['peptide_neuro']);
  });

  it('keeps GHK-Cu on copper_peptides — the fallback must not shadow it', () => {
    const facts = buildProductFacts(
      makeProduct({ fullIngredientText: 'Aqua, Copper Tripeptide-1, Glycerin' }),
      NOW,
    );
    expect(classKeys(facts)).toEqual(['copper_peptides']);
  });

  it('falls back to peptide_signal for an unrecognised peptide', () => {
    // Conservative default: no conflicts, but still visible to goal matching.
    const facts = buildProductFacts(
      makeProduct({ fullIngredientText: 'Aqua, Tripeptide-29, Glycerin' }),
      NOW,
    );
    expect(classKeys(facts)).toEqual(['peptide_signal']);
  });

  it('leaves peptide classes free of a stacking cap (mild: irritancy 1)', () => {
    const facts = buildProductFacts(
      makeProduct({ fullIngredientText: 'Aqua, Palmitoyl Tripeptide-1' }),
      NOW,
    );
    expect(facts.properties.irritancy).toBe(1);
  });
});

describe('buildProductFacts — rinseOff (spec phase-01 §1.5)', () => {
  it('marks cleansers and makeup removers as rinse-off', () => {
    expect(buildProductFacts(makeProduct({ productType: 'cleanser' }), NOW).rinseOff).toBe(true);
    expect(buildProductFacts(makeProduct({ productType: 'makeup_remover' }), NOW).rinseOff).toBe(
      true,
    );
  });

  it('treats every other product type as leave-on', () => {
    // peeling and mask are deliberately leave-on: peel gels rinse but peel pads
    // do not, and sleeping masks stay on. An ambiguous product consumes the
    // Phase 4 cumulative cap rather than escaping it (tech design Assumption 3).
    const leaveOn: Product['productType'][] = [
      'toner', 'essence', 'serum', 'gel', 'moisturizer', 'oil', 'spf', 'peeling',
      'ampoule', 'lotion', 'cream', 'eye_cream', 'mask', 'balm', 'spot_treatment', 'other',
    ];
    for (const productType of leaveOn) {
      expect({ productType, rinseOff: buildProductFacts(makeProduct({ productType }), NOW).rinseOff })
        .toEqual({ productType, rinseOff: false });
    }
  });
});
