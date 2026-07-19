/**
 * Integration tests for ingredientParser utilities
 *
 * Verifies that INCI text is correctly mapped to canonical active class keys
 * (per src/constants/rulesets/actives.json), that negative patterns and word
 * boundaries suppress false positives, and that getProductActiveKeys merges
 * explicit ingredient lists (normalizing legacy keys) and parsed INCI text
 * without duplicates.
 */

import {
  parseActiveIngredientsFromInci,
  parseActiveIngredientDetails,
  getProductActiveKeys,
  normalizeActiveKey,
} from '@/utils/ingredientParser';
import type { ActiveIngredientKey } from '@/types';

// ─── parseActiveIngredientsFromInci ───────────────────────────────────────────

describe('parseActiveIngredientsFromInci', () => {
  it('should return retinoid key when INCI text contains "retinol"', () => {
    const result = parseActiveIngredientsFromInci('Water, Squalane, Retinol, Fragrance');

    expect(result).toContain('retinoid');
  });

  it('should return retinoid key when INCI text contains "retinyl palmitate" synonym', () => {
    const result = parseActiveIngredientsFromInci('Aqua, Retinyl Palmitate, Tocopherol');

    expect(result).toContain('retinoid');
  });

  it('should return aha key when INCI text contains "glycolic acid"', () => {
    const result = parseActiveIngredientsFromInci('Water, Glycolic Acid, Aloe Vera');

    expect(result).toContain('aha');
  });

  it('should return aha key when INCI text contains "lactic acid"', () => {
    const result = parseActiveIngredientsFromInci('Water, Lactic Acid, Sodium PCA');

    expect(result).toContain('aha');
  });

  it('should return bha key when INCI text contains "salicylic acid"', () => {
    const result = parseActiveIngredientsFromInci('Water, Salicylic Acid, Niacinamide');

    expect(result).toContain('bha');
  });

  it('should return vitamin_c_pure key when INCI text contains "ascorbic acid"', () => {
    const result = parseActiveIngredientsFromInci('Aqua, Ascorbic Acid, Ferulic Acid');

    expect(result).toContain('vitamin_c_pure');
  });

  it('should return vitamin_c_derivative key when INCI text contains "sodium ascorbyl phosphate"', () => {
    const result = parseActiveIngredientsFromInci('Water, Sodium Ascorbyl Phosphate, Squalane');

    expect(result).toContain('vitamin_c_derivative');
    expect(result).not.toContain('vitamin_c_pure');
  });

  it('should return niacinamide key when INCI text contains "niacinamide"', () => {
    const result = parseActiveIngredientsFromInci('Water, Niacinamide, Zinc PCA');

    expect(result).toContain('niacinamide');
  });

  it('should return benzoyl_peroxide key when INCI text contains "benzoyl peroxide"', () => {
    const result = parseActiveIngredientsFromInci('Water, Benzoyl Peroxide, Aloe Vera');

    expect(result).toContain('benzoyl_peroxide');
  });

  it('should return copper_peptides key when INCI text contains "copper tripeptide-1"', () => {
    const result = parseActiveIngredientsFromInci('Water, Copper Tripeptide-1, Squalane');

    expect(result).toContain('copper_peptides');
  });

  it('should return spf_filters key when INCI text contains "zinc oxide"', () => {
    const result = parseActiveIngredientsFromInci('Water, Zinc Oxide, Dimethicone');

    expect(result).toContain('spf_filters');
  });

  it('should return spf_filters key when INCI text contains "titanium dioxide"', () => {
    const result = parseActiveIngredientsFromInci('Water, Titanium Dioxide, Dimethicone');

    expect(result).toContain('spf_filters');
  });

  it('should return pha key when INCI text contains "gluconolactone"', () => {
    const result = parseActiveIngredientsFromInci('Water, Gluconolactone, Squalane');

    expect(result).toContain('pha');
  });

  it('should return retinoid key when INCI text contains an rx retinoid (tretinoin)', () => {
    const result = parseActiveIngredientsFromInci('Tretinoin, Isopropyl Myristate');

    expect(result).toContain('retinoid');
  });

  it('should return multiple keys when INCI text contains several mapped ingredients', () => {
    const result = parseActiveIngredientsFromInci(
      'Water, Niacinamide, Ascorbic Acid, Retinol, Squalane',
    );

    const expected: ActiveIngredientKey[] = ['retinoid', 'vitamin_c_pure', 'niacinamide'];
    for (const key of expected) {
      expect(result).toContain(key);
    }
  });

  it('should return an empty array when INCI text contains no mapped ingredients', () => {
    const result = parseActiveIngredientsFromInci('Water, Squalane, Dimethicone, Tocopherol');

    expect(result).toHaveLength(0);
  });

  it('should return an empty array when INCI text is empty', () => {
    const result = parseActiveIngredientsFromInci('');

    expect(result).toHaveLength(0);
  });

  it('should match case-insensitively (uppercase INCI)', () => {
    const result = parseActiveIngredientsFromInci('WATER, RETINOL, NIACINAMIDE');

    expect(result).toContain('retinoid');
    expect(result).toContain('niacinamide');
  });

  it('should not return duplicate keys when the same ingredient appears multiple times in INCI text', () => {
    const result = parseActiveIngredientsFromInci('Retinol, Retinol, Retinol');

    const retinoidOccurrences = result.filter((k) => k === 'retinoid');
    expect(retinoidOccurrences).toHaveLength(1);
  });

  it('should not return duplicate aha key when both glycolic acid and lactic acid are present', () => {
    const result = parseActiveIngredientsFromInci('Glycolic Acid, Lactic Acid, Water');

    const ahaOccurrences = result.filter((k) => k === 'aha');
    expect(ahaOccurrences).toHaveLength(1);
  });

  // ── Negative patterns and word boundaries ──────────────────────────────────

  it('should not return retinoid key when text says "retinol-free"', () => {
    const result = parseActiveIngredientsFromInci('Retinol-free formula, Water, Squalane');

    expect(result).not.toContain('retinoid');
  });

  it('should not return aha key for "sodium lactate" (not an exfoliating acid)', () => {
    const result = parseActiveIngredientsFromInci('Water, Sodium Lactate, Squalane');

    expect(result).not.toContain('aha');
  });

  it('should not return pha key for "sulphate" (word-boundary guard)', () => {
    const result = parseActiveIngredientsFromInci('Sodium Laureth Sulphate, Water');

    expect(result).toHaveLength(0);
  });

  it('should not return aha key for "chamomilla" (word-boundary guard)', () => {
    const result = parseActiveIngredientsFromInci('Chamomilla Recutita Extract, Water');

    expect(result).not.toContain('aha');
  });

  it('should classify "3-o-ethyl ascorbic acid" as derivative only, never pure vitamin C', () => {
    const result = parseActiveIngredientsFromInci('Water, 3-O-Ethyl Ascorbic Acid, Squalane');

    expect(result).toContain('vitamin_c_derivative');
    expect(result).not.toContain('vitamin_c_pure');
  });

  it('should classify "ethylhexyl salicylate" as spf filter, not bha', () => {
    const result = parseActiveIngredientsFromInci('Ethylhexyl Salicylate, Water');

    expect(result).toContain('spf_filters');
    expect(result).not.toContain('bha');
  });
});

// ─── parseActiveIngredientDetails — matched-token attribution (FE-1/FE-6) ────
//
// Grounds docs/specs/inci-attribution-highlighting.md's "Hidden Alias"
// incident: the engine must expose which literal substring fired a match,
// not just the canonical class key.

describe('parseActiveIngredientDetails — matches attribution', () => {
  it('returns one MatchedToken carrying the literal matched substring when a single matcher fires', () => {
    const result = parseActiveIngredientDetails('Water, Betaine Salicylate, Squalane');

    const bha = result.find((detail) => detail.key === 'bha');
    expect(bha).toBeDefined();
    expect(bha?.matches).toEqual([
      { rawText: 'Betaine Salicylate', matcherPattern: '\\bbetaine\\s+salicylate\\b' },
    ]);
  });

  it('retains a MatchedToken for every matcher that fires within a class, not just the strongest-potency one', () => {
    const result = parseActiveIngredientDetails('Water, Salicylic Acid, Willow Bark Extract, Squalane');

    const bha = result.find((detail) => detail.key === 'bha');
    expect(bha?.potency).toBe('high'); // salicylic acid (high) wins over willow bark (low)
    expect(bha?.matches).toHaveLength(2);
    expect(bha?.matches.map((m) => m.rawText)).toEqual(
      expect.arrayContaining(['Salicylic Acid', 'Willow Bark']),
    );
  });

  it('uses the exact regex source string as matcherPattern, matching aliasOverrides.json keys verbatim', () => {
    const result = parseActiveIngredientDetails('Water, Willow Bark Extract, Squalane');

    const bha = result.find((detail) => detail.key === 'bha');
    expect(bha?.matches[0]?.matcherPattern).toBe('\\b(salix\\s+alba|willow\\s+bark)\\b');
  });

  it('produces no match/no token when the only occurrence is stripped by a negative pattern', () => {
    const result = parseActiveIngredientDetails('Retinol-free formula, Water, Squalane');

    expect(result.find((detail) => detail.key === 'retinoid')).toBeUndefined();
  });

  it('omits a class entirely from the result when none of its matchers fire', () => {
    const result = parseActiveIngredientDetails('Water, Squalane, Dimethicone');

    expect(result).toHaveLength(0);
  });

  it('does not affect parseActiveIngredientsFromInci or getProductActiveKeys, which only read .key', () => {
    const keys = parseActiveIngredientsFromInci('Water, Betaine Salicylate, Niacinamide');
    expect(keys).toEqual(expect.arrayContaining(['bha', 'niacinamide']));

    const productKeys = getProductActiveKeys({
      activeIngredients: [],
      fullIngredientText: 'Water, Betaine Salicylate, Niacinamide',
    });
    expect(productKeys).toEqual(expect.arrayContaining(['bha', 'niacinamide']));
  });
});

// ─── normalizeActiveKey ───────────────────────────────────────────────────────

describe('normalizeActiveKey', () => {
  it('should map legacy retinol tag to retinoid', () => {
    expect(normalizeActiveKey('retinol')).toBe('retinoid');
  });

  it('should map legacy vitamin_c tag to vitamin_c_pure (conservative default)', () => {
    expect(normalizeActiveKey('vitamin_c')).toBe('vitamin_c_pure');
  });

  it('should map legacy spf_chemical tag to spf_filters', () => {
    expect(normalizeActiveKey('spf_chemical')).toBe('spf_filters');
  });

  it('should return canonical keys unchanged', () => {
    expect(normalizeActiveKey('aha')).toBe('aha');
    expect(normalizeActiveKey('retinoid')).toBe('retinoid');
  });
});

// ─── getProductActiveKeys ─────────────────────────────────────────────────────

describe('getProductActiveKeys', () => {
  it('should return keys from explicit activeIngredients when fullIngredientText is null', () => {
    const product = {
      activeIngredients: [
        { key: 'retinoid' as ActiveIngredientKey, displayName: 'Retinoids' },
        { key: 'niacinamide' as ActiveIngredientKey, displayName: 'Niacinamide' },
      ],
      fullIngredientText: null,
    };

    const result = getProductActiveKeys(product);

    expect(result).toContain('retinoid');
    expect(result).toContain('niacinamide');
  });

  it('should normalize legacy explicit keys to canonical keys', () => {
    const product = {
      activeIngredients: [
        { key: 'retinol' as ActiveIngredientKey, displayName: 'Retinol' },
        { key: 'vitamin_c' as ActiveIngredientKey, displayName: 'Vitamin C' },
      ],
      fullIngredientText: null,
    };

    const result = getProductActiveKeys(product);

    expect(result).toContain('retinoid');
    expect(result).toContain('vitamin_c_pure');
    expect(result).not.toContain('retinol');
    expect(result).not.toContain('vitamin_c');
  });

  it('should return keys parsed from fullIngredientText when activeIngredients is empty', () => {
    const product = {
      activeIngredients: [],
      fullIngredientText: 'Water, Salicylic Acid, Aloe Vera',
    };

    const result = getProductActiveKeys(product);

    expect(result).toContain('bha');
  });

  it('should merge keys from both activeIngredients and fullIngredientText', () => {
    const product = {
      activeIngredients: [{ key: 'retinoid' as ActiveIngredientKey, displayName: 'Retinoids' }],
      fullIngredientText: 'Water, Niacinamide, Squalane',
    };

    const result = getProductActiveKeys(product);

    expect(result).toContain('retinoid');
    expect(result).toContain('niacinamide');
  });

  it('should not return duplicates when a legacy tag and its parsed canonical key both resolve to the same class', () => {
    const product = {
      activeIngredients: [{ key: 'retinol' as ActiveIngredientKey, displayName: 'Retinol' }],
      fullIngredientText: 'Water, Retinol, Squalane',
    };

    const result = getProductActiveKeys(product);

    const retinoidOccurrences = result.filter((k) => k === 'retinoid');
    expect(retinoidOccurrences).toHaveLength(1);
  });

  it('should return an empty array when both activeIngredients and fullIngredientText are empty/null', () => {
    const product = {
      activeIngredients: [],
      fullIngredientText: null,
    };

    const result = getProductActiveKeys(product);

    expect(result).toHaveLength(0);
  });

  it('should return an empty array when activeIngredients is empty and fullIngredientText has no mapped ingredients', () => {
    const product = {
      activeIngredients: [],
      fullIngredientText: 'Water, Squalane, Dimethicone',
    };

    const result = getProductActiveKeys(product);

    expect(result).toHaveLength(0);
  });
});

describe('position-gated attribution (phase-03 §consultant items)', () => {
  it('attributes glycerin_class when glycerin sits in the leading positions', () => {
    const result = parseActiveIngredientsFromInci('Aqua, Glycerin, Niacinamide, Dimethicone');
    expect(result).toContain('glycerin_class');
  });

  it('does not attribute glycerin_class from a tail-of-list trace', () => {
    // Position 7 > requireWithinPosition 5 — the near-universal-base case the
    // gate exists for: practically every formula carries some glycerin.
    const result = parseActiveIngredientsFromInci(
      'Aqua, Niacinamide, Dimethicone, Squalane, Tocopherol, Panthenol, Glycerin',
    );
    expect(result).not.toContain('glycerin_class');
  });

  it('downgrades a tail-of-list AHA to low potency instead of dropping it', () => {
    // The "acid cream with glycolic at the INCI tail" case: the class stays
    // visible to safety checks (do-no-harm), at trace potency.
    const detail = parseActiveIngredientDetails(
      'Aqua, Squalane, Dimethicone, Cetearyl Alcohol, Ceteareth-20, Tocopherol, Phenoxyethanol, Parfum, Glycolic Acid',
    ).find((d) => d.key === 'aha');

    expect(detail).toBeDefined();
    expect(detail?.position).toBe(9);
    expect(detail?.potency).toBe('low');
  });

  it('keeps full potency for an AHA in the leading positions', () => {
    const detail = parseActiveIngredientDetails('Aqua, Glycolic Acid, Squalane').find(
      (d) => d.key === 'aha',
    );
    expect(detail?.position).toBe(2);
    expect(detail?.potency).toBe('high');
  });

  it('treats freeform text without commas as position 1 — gates never fire', () => {
    const details = parseActiveIngredientDetails('contains glycolic acid and glycerin');
    expect(details.find((d) => d.key === 'aha')?.potency).toBe('high');
    expect(details.map((d) => d.key)).toContain('glycerin_class');
  });

  it('reports the earliest position when a class matches several tokens', () => {
    const detail = parseActiveIngredientDetails(
      'Aqua, Salicylic Acid, Squalane, Willow Bark Extract',
    ).find((d) => d.key === 'bha');
    expect(detail?.position).toBe(2);
  });
});
