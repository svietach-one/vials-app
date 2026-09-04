/**
 * ConflictEngine.checkPregnancyConflict's per-procedure severity table
 * (pregnancy-safety-handling tech design FE-8/FE-9). Separate file from
 * conflictEngine.test.ts because PREGNANCY_SAFETY_ENABLED must be mocked ON
 * to exercise the severity table at all — jest.mock is file-scoped/hoisted,
 * so this stays split from the real-flag guard rail in conflictEngine.test.ts
 * (mirrors tests/pregnancy-safety-handling/pregnancy-freeze-enabled.test.ts's
 * split from its -disabled sibling).
 */
jest.mock('@/constants/featureFlags', () => ({
  ...jest.requireActual('@/constants/featureFlags'),
  PREGNANCY_SAFETY_ENABLED: true,
}));

import { ConflictEngine } from '@/utils/conflictEngine';
import type { CosmeticProcedureKey } from '@/types';

describe('ConflictEngine.checkPregnancyConflict — flag on, profile pregnant', () => {
  it.each<CosmeticProcedureKey>([
    'botox',
    'fillers',
    'smas_lifting',
    'mesotherapy',
    'chemical_peel_deep',
  ])('returns an avoid-severity result for %s', (procedure) => {
    const result = ConflictEngine.checkPregnancyConflict(procedure, true);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('avoid');
    expect(result!.explanation.length).toBeGreaterThan(0);
    expect(result!.suggestion.length).toBeGreaterThan(0);
  });

  it('returns a caution-severity result for mechanical_facial', () => {
    const result = ConflictEngine.checkPregnancyConflict('mechanical_facial', true);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('caution');
  });

  it('routes every suggestion to a doctor or practitioner, never a categorical medical claim', () => {
    const procedures: CosmeticProcedureKey[] = [
      'botox',
      'fillers',
      'smas_lifting',
      'mesotherapy',
      'chemical_peel_deep',
      'mechanical_facial',
    ];
    for (const procedure of procedures) {
      const result = ConflictEngine.checkPregnancyConflict(procedure, true);
      expect(result?.suggestion).toMatch(/doctor|practitioner/i);
    }
  });

  it('returns null when the profile is not pregnant, even for an avoid-severity procedure', () => {
    const result = ConflictEngine.checkPregnancyConflict('botox', false);

    expect(result).toBeNull();
  });
});
