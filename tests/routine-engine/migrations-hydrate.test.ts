/**
 * Integration tests — schema-v2 hydrate migration composition
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 7 (legacy phototype)
 * and Story 9 (legacy vitamin C); tech-design §6 Data Requirements.
 *
 * Per the task guidance, store-level hydrate integration is covered by
 * running the pure migration functions composed the SAME way the real
 * stores call them on hydrate (productsStore/profileStore/routinesStore),
 * without mocking AsyncStorage — these functions take/return plain data and
 * never touch storage themselves, so this is a faithful integration
 * simulation of "legacy data on disk -> canonical in-memory state" without
 * needing a real or mocked AsyncStorage.
 */
import type { Product, Routine, UserProfile } from '@/types';
import { migrateProducts, migrateProfile, migrateRoutines } from '@/utils/routineEngine/migrations';
import { makeFullProfile, makeProduct, makeRoutine, makeRoutineStep, resetFixtureCounters } from './fixtures';

beforeEach(() => resetFixtureCounters());

/** Simulates one hydrate pass across the three stores that migrate persisted data. */
function simulateHydrate(persisted: { profile: UserProfile; products: Product[]; routines: Routine[] }) {
  return {
    profile: migrateProfile(persisted.profile),
    products: migrateProducts(persisted.products),
    routines: migrateRoutines(persisted.routines),
  };
}

describe('Hydrate composition: a v1 (pre-ruleset) snapshot migrates to the full v2 shape in one pass', () => {
  it('derives fitzpatrick + city, canonicalizes tags with the vitamin-C marker, and defaults routine step fields — all at once', () => {
    const legacyProfile = makeFullProfile({ phototype: 'type_3_4' });
    delete (legacyProfile as Partial<UserProfile>).city; // simulate pre-schema-v2 storage (field absent)

    const legacyVitC = makeProduct({ activeTags: ['vitamin_c'] });
    const legacyRetinol: Product = { ...makeProduct(), activeIngredients: [{ key: 'retinol', displayName: 'Retinol' }] };

    // Pre-field routines had neither scheduledDays nor userPinned on their steps.
    const legacyStep = makeRoutineStep(legacyVitC);
    delete (legacyStep as { userPinned?: boolean }).userPinned;
    delete (legacyStep as { scheduledDays?: number[] }).scheduledDays;
    const legacyRoutine: Routine = makeRoutine('morning', [legacyStep]);

    const result = simulateHydrate({
      profile: legacyProfile,
      products: [legacyVitC, legacyRetinol],
      routines: [legacyRoutine],
    });

    expect(result.profile.fitzpatrick).toBe(4); // type_3_4 -> stricter member
    expect(result.profile.city).toBeNull();
    expect(result.products[0].activeTags).toEqual(['vitamin_c_pure']);
    expect(result.products[0].vitaminCAutoMigrated).toBe(true);
    expect(result.products[1].activeIngredients).toEqual([{ key: 'retinoid', displayName: 'Retinol' }]);
    expect(result.routines[0].steps[0].scheduledDays).toEqual([]);
    expect(result.routines[0].steps[0].userPinned).toBe(false);
  });

  it('is idempotent: migrating already-migrated data a second time returns the same references (no persist churn)', () => {
    const legacyProfile = makeFullProfile({ phototype: 'type_1_2' });
    const legacyVitC = makeProduct({ activeTags: ['vitamin_c'] });
    const legacyRoutine = makeRoutine('evening', [makeRoutineStep(legacyVitC)]);

    const first = simulateHydrate({ profile: legacyProfile, products: [legacyVitC], routines: [legacyRoutine] });
    const second = simulateHydrate({
      profile: first.profile,
      products: first.products,
      routines: first.routines,
    });

    expect(second.profile).toBe(first.profile);
    expect(second.products).toBe(first.products);
    expect(second.routines).toBe(first.routines);
  });

  it('does not fire the vitamin-C marker for a product that never had the legacy tag', () => {
    const clean = makeProduct({ activeTags: ['niacinamide'] });
    const result = simulateHydrate({
      profile: makeFullProfile(),
      products: [clean],
      routines: [],
    });
    expect(result.products[0]).toBe(clean);
    expect(result.products[0].vitaminCAutoMigrated).toBeUndefined();
  });

  it('leaves a null grouped phototype as a null numeric fitzpatrick (no forced default)', () => {
    const profile = makeFullProfile({ phototype: null });
    delete (profile as Partial<UserProfile>).city;
    const result = migrateProfile(profile);
    expect(result.fitzpatrick).toBeNull();
    expect(result.city).toBeNull();
  });
});
