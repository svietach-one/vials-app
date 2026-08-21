import { joinActiveKeys } from '@/utils/productProfile/join';

describe('joinActiveKeys', () => {
  it('returns an empty array for an empty key list', () => {
    expect(joinActiveKeys([])).toEqual([]);
  });

  it('joins each resolved key to its full actives.json class record', () => {
    const records = joinActiveKeys(['ceramides']);

    expect(records).toHaveLength(1);
    expect(records[0].key).toBe('ceramides');
    expect(records[0].activeClass.properties.barrierRepair).toBe(true);
    expect(records[0].activeClass.displayName).toBeTruthy();
  });

  it('preserves resolvedActiveKeys order, one record per key', () => {
    const records = joinActiveKeys(['niacinamide', 'ceramides']);

    expect(records.map((r) => r.key)).toEqual(['niacinamide', 'ceramides']);
  });

  it('attaches the matching potency from potencyByKey when present', () => {
    const records = joinActiveKeys(['vitamin_c_pure'], { vitamin_c_pure: 'high' });

    expect(records[0].potency).toBe('high');
  });

  it('leaves potency undefined when no entry exists in potencyByKey', () => {
    const records = joinActiveKeys(['ceramides'], {});

    expect(records[0].potency).toBeUndefined();
  });

  it('skips a key with no matching actives.json class rather than throwing', () => {
    const records = joinActiveKeys(['not_a_real_key' as never]);

    expect(records).toEqual([]);
  });
});
