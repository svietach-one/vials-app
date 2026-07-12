import { findIntraProductConflicts } from './conflictPreview';

describe('findIntraProductConflicts', () => {
  it('returns the rule when both sides of a conflict pair are present', () => {
    const hits = findIntraProductConflicts(['retinoid', 'aha']);

    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe('rule_retinol_aha');
  });

  it('matches regardless of key order', () => {
    const hits = findIntraProductConflicts(['aha', 'retinoid']);

    expect(hits.map((r) => r.id)).toEqual(['rule_retinol_aha']);
  });

  it('normalizes legacy keys before matching', () => {
    // Legacy 'retinol' tag resolves to canonical 'retinoid'.
    const hits = findIntraProductConflicts(['retinol', 'bha']);

    expect(hits.map((r) => r.id)).toEqual(['rule_retinol_bha']);
  });

  it('returns every matching pair when several conflicts coexist', () => {
    const hits = findIntraProductConflicts(['retinoid', 'aha', 'bha']);

    expect(hits.map((r) => r.id).sort()).toEqual(['rule_retinol_aha', 'rule_retinol_bha']);
  });

  it('returns empty for non-conflicting or single keys', () => {
    expect(findIntraProductConflicts(['niacinamide', 'ceramides'])).toEqual([]);
    expect(findIntraProductConflicts(['retinoid'])).toEqual([]);
    expect(findIntraProductConflicts([])).toEqual([]);
  });
});
