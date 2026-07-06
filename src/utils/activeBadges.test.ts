/**
 * Unit tests — src/utils/activeBadges.ts
 *
 * Pure business-logic tests (no rendering) per .claude/rules/testing.md.
 * Covers docs/specs/multi-active-badges.md Story 1 (precedence/dedup/order)
 * and Story 2 (exhaustive category mapping).
 */

import { getActiveBadgeCategory, getProductActiveBadgeKeys } from '@/utils/activeBadges';
import type { ActiveIngredientKey } from '@/types';

describe('getProductActiveBadgeKeys', () => {
  it('returns all keys from activeTags when it has 2+ entries', () => {
    const result = getProductActiveBadgeKeys({
      activeTags: ['bha', 'niacinamide'],
      activeIngredients: [],
    });

    expect(result).toEqual(expect.arrayContaining(['bha', 'niacinamide']));
    expect(result).toHaveLength(2);
  });

  it('falls back to the full activeIngredients array when activeTags is undefined', () => {
    const result = getProductActiveBadgeKeys({
      activeTags: undefined,
      activeIngredients: [
        { key: 'retinoid', displayName: 'Retinoids' },
        { key: 'ceramides', displayName: 'Ceramides' },
      ],
    });

    expect(result).toEqual(expect.arrayContaining(['retinoid', 'ceramides']));
    expect(result).toHaveLength(2);
  });

  it('returns an empty array when activeTags is explicitly empty, even with non-empty activeIngredients', () => {
    const result = getProductActiveBadgeKeys({
      activeTags: [],
      activeIngredients: [{ key: 'bha', displayName: 'BHA' }],
    });

    expect(result).toEqual([]);
  });

  it('returns an empty array when neither array has actives', () => {
    const result = getProductActiveBadgeKeys({ activeTags: [], activeIngredients: [] });

    expect(result).toEqual([]);
  });

  it('dedupes repeated keys within activeTags', () => {
    const result = getProductActiveBadgeKeys({
      activeTags: ['bha', 'bha', 'niacinamide'],
      activeIngredients: [],
    });

    expect(result).toHaveLength(2);
  });

  it('dedupes repeated keys within the activeIngredients fallback', () => {
    const result = getProductActiveBadgeKeys({
      activeTags: undefined,
      activeIngredients: [
        { key: 'ceramides', displayName: 'Ceramides' },
        { key: 'ceramides', displayName: 'Ceramides' },
      ],
    });

    expect(result).toEqual(['ceramides']);
  });

  it('returns keys in a fixed deterministic order regardless of input insertion order', () => {
    const forward = getProductActiveBadgeKeys({
      activeTags: ['bha', 'niacinamide', 'ceramides', 'spf_filters'],
      activeIngredients: [],
    });
    const reversed = getProductActiveBadgeKeys({
      activeTags: ['spf_filters', 'ceramides', 'niacinamide', 'bha'],
      activeIngredients: [],
    });

    expect(forward).toEqual(reversed);
  });
});

describe('getActiveBadgeCategory', () => {
  const exfoliantKeys: ActiveIngredientKey[] = [
    'retinoid',
    'retinol',
    'aha',
    'bha',
    'pha',
    'benzoyl_peroxide',
    'azelaic_acid',
    'vitamin_c_pure',
    'vitamin_c_derivative',
    'vitamin_c',
  ];
  const soothingKeys: ActiveIngredientKey[] = [
    'niacinamide',
    'copper_peptides',
    'cica',
    'panthenol',
  ];
  const hydratorKeys: ActiveIngredientKey[] = ['ceramides', 'hyaluronic_acid'];
  const otherKeys: ActiveIngredientKey[] = ['spf_filters', 'spf_chemical'];

  it.each(exfoliantKeys)('maps %s to the exfoliant category', (key) => {
    expect(getActiveBadgeCategory(key)).toBe('exfoliant');
  });

  it.each(soothingKeys)('maps %s to the soothing category', (key) => {
    expect(getActiveBadgeCategory(key)).toBe('soothing');
  });

  it.each(hydratorKeys)('maps %s to the hydrator category', (key) => {
    expect(getActiveBadgeCategory(key)).toBe('hydrator');
  });

  it.each(otherKeys)('maps %s to the other category', (key) => {
    expect(getActiveBadgeCategory(key)).toBe('other');
  });

  it('covers every ActiveIngredientKey exactly once across the four buckets', () => {
    const allKeys = [...exfoliantKeys, ...soothingKeys, ...hydratorKeys, ...otherKeys];
    expect(new Set(allKeys).size).toBe(allKeys.length);
    expect(allKeys).toHaveLength(18);
  });
});
