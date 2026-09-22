import { buildSkinTypeCaution } from '@/utils/productProfile/skinTypeCaution';
import { joinActiveKeys } from '@/utils/productProfile/join';

describe('buildSkinTypeCaution — Story 7 (2026-08-26 decision batch, FE-11)', () => {
  it('returns null when no present class is exfoliating, photosensitizing, or irritancy>=3', () => {
    // ceramides/niacinamide: neither exfoliating nor photosensitizing, irritancy 0/1.
    const classFacts = joinActiveKeys(['ceramides', 'niacinamide']);

    expect(buildSkinTypeCaution(classFacts)).toBeNull();
  });

  it('fires when a present class has exfoliating === true (aha)', () => {
    const classFacts = joinActiveKeys(['aha']);

    expect(buildSkinTypeCaution(classFacts)).toEqual({ triggeringKeys: ['aha'] });
  });

  it('fires when a present class has photosensitizing === true, independent of exfoliating (benzoyl_peroxide)', () => {
    const classFacts = joinActiveKeys(['benzoyl_peroxide']);

    expect(buildSkinTypeCaution(classFacts)).toEqual({ triggeringKeys: ['benzoyl_peroxide'] });
  });

  it('fires when a present class has irritancy >= 3, read from the flat tier (aha, irritancy 3)', () => {
    const classFacts = joinActiveKeys(['aha']);
    const [record] = classFacts;

    expect(record.activeClass.properties.irritancy).toBe(3);
    expect(buildSkinTypeCaution(classFacts)).not.toBeNull();
  });

  it('does NOT suppress the trigger when a barrierRepair class is also present — the deliberately loosened definition', () => {
    // aha (exfoliating/photosensitizing/irritancy:3) + niacinamide (barrierRepair: true).
    const classFacts = joinActiveKeys(['aha', 'niacinamide']);

    expect(buildSkinTypeCaution(classFacts)).toEqual({ triggeringKeys: ['aha'] });
  });

  it('names every triggering class, not just the first', () => {
    // aha (exfoliating/photosensitizing) + benzoyl_peroxide (photosensitizing, irritancy 4).
    const classFacts = joinActiveKeys(['aha', 'benzoyl_peroxide']);

    const result = buildSkinTypeCaution(classFacts);
    expect(result?.triggeringKeys).toEqual(
      expect.arrayContaining(['aha', 'benzoyl_peroxide']),
    );
    expect(result?.triggeringKeys).toHaveLength(2);
  });

  it('returns null for an empty classFacts array', () => {
    expect(buildSkinTypeCaution([])).toBeNull();
  });
});
