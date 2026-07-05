/**
 * Integration tests — Story 9: Vitamin C reclassification
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 9
 *
 * The product-detail infobox UI (FE-9, shipped) is covered separately in
 * tests/routine-engine/product-detail-vitc-infobox.test.tsx. This
 * file covers the two engine-level ACs: the migration itself (via
 * migrateProducts, exercised more thoroughly for cross-field composition in
 * migrations-hydrate.test.ts) and its downstream effect on pair-rule matching
 * once the engine actually resolves/validates a routine.
 */
import type { Product } from '@/types';
import { migrateProducts } from '@/utils/routineEngine/migrations';
import { validateRoutines } from '@/utils/routineEngine/validate';
import { makeEngineInput, makeProduct, makeRoutine, makeRoutineStep, resetFixtureCounters } from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Story 9 AC: a legacy vitamin_c tag migrates to vitamin_c_pure with the auto-migrated marker', () => {
  it('canonicalizes the legacy tag and sets vitaminCAutoMigrated, leaving other products untouched (same reference)', () => {
    const legacy = makeProduct({ activeTags: ['vitamin_c'] });
    const untouched = makeProduct({ activeTags: ['niacinamide'] });
    const [migratedLegacy, migratedUntouched] = migrateProducts([legacy, untouched]);

    expect(migratedLegacy.activeTags).toEqual(['vitamin_c_pure']);
    expect(migratedLegacy.vitaminCAutoMigrated).toBe(true);
    expect(migratedUntouched).toBe(untouched); // same reference — no unnecessary migration
  });
});

describe('Story 9 AC: pure-C low-pH pair rules apply to the migrated product until reclassified', () => {
  it('flags the auto-migrated (still pure) product against an acid under rule_vitc_pure_acids', () => {
    const legacy = makeProduct({ activeTags: ['vitamin_c'] });
    const [migrated] = migrateProducts([legacy]);
    const bha = makeProduct({ activeTags: ['bha'] });

    const routines = [makeRoutine('morning', [makeRoutineStep(migrated), makeRoutineStep(bha)])];
    const result = validateRoutines(routines, makeEngineInput([migrated, bha]));

    expect(result.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: 'rule_vitc_pure_acids' })]),
    );
  });

  it('stops matching the pure-C acid rule once the user reclassifies the product as a derivative', () => {
    const legacy = makeProduct({ activeTags: ['vitamin_c'] });
    const [migrated] = migrateProducts([legacy]);
    const reclassified: Product = { ...migrated, activeTags: ['vitamin_c_derivative'] };
    const bha = makeProduct({ activeTags: ['bha'] });

    const routines = [makeRoutine('morning', [makeRoutineStep(reclassified), makeRoutineStep(bha)])];
    const result = validateRoutines(routines, makeEngineInput([reclassified, bha]));

    expect(result.findings.some((f) => f.ruleId === 'rule_vitc_pure_acids')).toBe(false);
  });
});

// Story 9 UI AC (the migrated-product infobox) is activated as a component
// test in tests/routine-engine/product-detail-vitc-infobox.test.tsx now that
// FE-9 shipped it (progress/routine-engine.md, 2026-07-05 entry) — kept out of
// this file since it needs @testing-library/react-native rendering. DEVIATION
// (documented in the same log entry): the spec's "link into the tag wizard"
// became a one-tap in-place reclassification — no wizard deep-link route
// exists for a return trip, and the in-place swap achieves the same outcome.
