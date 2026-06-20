/**
 * Integration tests for ingredientParser utilities
 *
 * Verifies that INCI text is correctly mapped to ActiveIngredientKey values
 * and that getProductActiveKeys merges both explicit ingredient lists and
 * parsed INCI text without duplicates.
 */

import {
  parseActiveIngredientsFromInci,
  getProductActiveKeys,
} from '@/utils/ingredientParser';
import type { ActiveIngredientKey } from '@/types';

// ─── parseActiveIngredientsFromInci ───────────────────────────────────────────

describe('parseActiveIngredientsFromInci', () => {
  it('should return retinol key when INCI text contains "retinol"', () => {
    const result = parseActiveIngredientsFromInci('Water, Glycerin, Retinol, Fragrance');

    expect(result).toContain('retinol');
  });

  it('should return retinol key when INCI text contains "retinyl palmitate" synonym', () => {
    const result = parseActiveIngredientsFromInci('Aqua, Retinyl Palmitate, Tocopherol');

    expect(result).toContain('retinol');
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

  it('should return vitamin_c key when INCI text contains "ascorbic acid"', () => {
    const result = parseActiveIngredientsFromInci('Aqua, Ascorbic Acid, Ferulic Acid');

    expect(result).toContain('vitamin_c');
  });

  it('should return vitamin_c key when INCI text contains "sodium ascorbyl phosphate" synonym', () => {
    const result = parseActiveIngredientsFromInci('Water, Sodium Ascorbyl Phosphate, Glycerin');

    expect(result).toContain('vitamin_c');
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
    const result = parseActiveIngredientsFromInci('Water, Copper Tripeptide-1, Hyaluronic Acid');

    expect(result).toContain('copper_peptides');
  });

  it('should return spf_chemical key when INCI text contains "zinc oxide"', () => {
    const result = parseActiveIngredientsFromInci('Water, Zinc Oxide, Titanium Dioxide');

    expect(result).toContain('spf_chemical');
  });

  it('should return spf_chemical key when INCI text contains "titanium dioxide"', () => {
    const result = parseActiveIngredientsFromInci('Water, Titanium Dioxide, Dimethicone');

    expect(result).toContain('spf_chemical');
  });

  it('should return multiple keys when INCI text contains several mapped ingredients', () => {
    const result = parseActiveIngredientsFromInci(
      'Water, Niacinamide, Ascorbic Acid, Retinol, Glycerin',
    );

    const expected: ActiveIngredientKey[] = ['retinol', 'vitamin_c', 'niacinamide'];
    for (const key of expected) {
      expect(result).toContain(key);
    }
  });

  it('should return an empty array when INCI text contains no mapped ingredients', () => {
    const result = parseActiveIngredientsFromInci('Water, Glycerin, Hyaluronic Acid, Tocopherol');

    expect(result).toHaveLength(0);
  });

  it('should return an empty array when INCI text is empty', () => {
    const result = parseActiveIngredientsFromInci('');

    expect(result).toHaveLength(0);
  });

  it('should match case-insensitively (uppercase INCI)', () => {
    const result = parseActiveIngredientsFromInci('WATER, RETINOL, NIACINAMIDE');

    expect(result).toContain('retinol');
    expect(result).toContain('niacinamide');
  });

  it('should not return duplicate keys when the same ingredient appears multiple times in INCI text', () => {
    const result = parseActiveIngredientsFromInci('Retinol, Retinol, Retinol');

    const retinolOccurrences = result.filter((k) => k === 'retinol');
    expect(retinolOccurrences).toHaveLength(1);
  });

  it('should not return duplicate aha key when both glycolic acid and lactic acid are present', () => {
    const result = parseActiveIngredientsFromInci('Glycolic Acid, Lactic Acid, Water');

    const ahaOccurrences = result.filter((k) => k === 'aha');
    expect(ahaOccurrences).toHaveLength(1);
  });
});

// ─── getProductActiveKeys ─────────────────────────────────────────────────────

describe('getProductActiveKeys', () => {
  it('should return keys from explicit activeIngredients when fullIngredientText is null', () => {
    const product = {
      activeIngredients: [
        { key: 'retinol' as ActiveIngredientKey, displayName: 'Retinol' },
        { key: 'niacinamide' as ActiveIngredientKey, displayName: 'Niacinamide' },
      ],
      fullIngredientText: null,
    };

    const result = getProductActiveKeys(product);

    expect(result).toContain('retinol');
    expect(result).toContain('niacinamide');
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
      activeIngredients: [{ key: 'retinol' as ActiveIngredientKey, displayName: 'Retinol' }],
      fullIngredientText: 'Water, Niacinamide, Glycerin',
    };

    const result = getProductActiveKeys(product);

    expect(result).toContain('retinol');
    expect(result).toContain('niacinamide');
  });

  it('should not return duplicates when an ingredient appears in both activeIngredients and fullIngredientText', () => {
    const product = {
      activeIngredients: [{ key: 'retinol' as ActiveIngredientKey, displayName: 'Retinol' }],
      fullIngredientText: 'Water, Retinol, Glycerin',
    };

    const result = getProductActiveKeys(product);

    const retinolOccurrences = result.filter((k) => k === 'retinol');
    expect(retinolOccurrences).toHaveLength(1);
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
      fullIngredientText: 'Water, Glycerin, Hyaluronic Acid',
    };

    const result = getProductActiveKeys(product);

    expect(result).toHaveLength(0);
  });
});
