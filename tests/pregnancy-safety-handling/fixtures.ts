import type { AddProcedureModalProps } from '@/components/clinic/AddProcedureModal';
import type { Product, UserProfile } from '@/types';
import type { DailyViewInput } from '@/utils/routineEngine/dailyView';
import type { EngineInput } from '@/utils/routineEngine/generate';
import {
  makeFullProfile,
  makeProduct,
  NOW,
} from '../routine-engine/fixtures';

/**
 * Shared fixtures for the pregnancy-safety-handling integration suite.
 * Spec: docs/specs/pregnancy-safety-handling.md
 * Tech design: docs/tech-design/pregnancy-safety-handling.md
 *
 * Wraps the routine-engine suite's shared factories (id-counters, product/
 * routine/procedure builders) instead of re-implementing them — precedent:
 * tests/catalog/product-shelf-card-hidden.test.tsx imports
 * `../product-shelf-card/fixtures`. Only pregnancy-specific helpers live here.
 */
export {
  makeEngineInput,
  makeFullProfile,
  makeProcedureLog,
  makeProduct,
  makeRoutine,
  makeRoutineStep,
  makeSeasonMask,
  NOW,
  resetFixtureCounters,
  routinesFromPlan,
} from '../routine-engine/fixtures';

/**
 * A product carrying the retinoid class, one of the two classes the pregnancy
 * freeze targets (spec §3 non-goals explicitly excludes AHA/BHA/benzoyl_
 * peroxide/salicylic acid — concentration-dependent, engine can't dose-
 * distinguish; hydroquinone was added in engine4.1 handoff §4, see
 * `makeHydroquinoneProduct`). `usageTime: 'evening'` matches how a real
 * retinoid product would be tagged (PM-only class, period-safety.test.ts).
 */
export function makeRetinoidProduct(overrides: Partial<Product> = {}): Product {
  return makeProduct({
    activeTags: ['retinoid'],
    productType: 'serum',
    usageTime: 'evening',
    ...overrides,
  });
}

/** A product carrying the hydroquinone class — the second pregnancy-freeze target (engine4.1 handoff §4). PM-only, same as retinoid. */
export function makeHydroquinoneProduct(overrides: Partial<Product> = {}): Product {
  return makeProduct({
    activeTags: ['hydroquinone'],
    productType: 'serum',
    usageTime: 'evening',
    ...overrides,
  });
}

/**
 * Builds an `EngineInput` whose profile carries `pregnantOrBreastfeeding`.
 *
 * NOTE: `EngineInput['profile']` (src/utils/routineEngine/generate.ts) does
 * not include this field until tech design FE-4 extends the `Pick` it's built
 * from — this factory is EXPECTED to fail `npx tsc --noEmit` until then
 * (test-before-code, .claude/rules/testing.md; same expectation documented in
 * tests/onboarding-5-step-redesign/AdditionalInfoStep.test.tsx for FE-8).
 */
export function makePregnancyEngineInput(
  products: Product[],
  pregnantOrBreastfeeding: boolean,
  overrides: Partial<Omit<EngineInput, 'profile'>> & {
    profile?: Partial<EngineInput['profile']>;
  } = {},
): EngineInput {
  // `profile` overrides are genuinely partial (e.g. just `primaryGoal`) so a
  // caller doesn't have to re-supply `fitzpatrick`/`concerns`/
  // `pregnantOrBreastfeeding` on every call.
  const { profile: profileOverrides, ...rest } = overrides;
  return {
    products,
    procedures: [],
    profile: { fitzpatrick: null, concerns: [], pregnantOrBreastfeeding, ...profileOverrides },
    seasonMask: { season: 'spring', source: 'calendar' },
    now: NOW,
    ...rest,
  };
}

/**
 * Builds a `DailyViewInput` whose profile carries `pregnantOrBreastfeeding`.
 *
 * NOTE: `DailyViewInput['profile']` (src/utils/routineEngine/dailyView.ts) is
 * `Pick<UserProfile, 'fitzpatrick'>` today — extending it to also carry
 * `pregnantOrBreastfeeding` is part of tech design FE-6's wiring. Same
 * pre-implementation compile-failure expectation as
 * `makePregnancyEngineInput` above.
 */
export function makePregnancyDailyViewInput(
  pregnantOrBreastfeeding: boolean,
  overrides: Partial<DailyViewInput> = {},
): DailyViewInput {
  return {
    procedures: [],
    profile: { fitzpatrick: null, pregnantOrBreastfeeding },
    seasonMask: { season: 'spring', source: 'calendar' },
    now: NOW,
    ...overrides,
  };
}

/** Full `UserProfile` for AddProcedureModal's `useProfileStore` consumer. */
export function makeModalProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return makeFullProfile({ phototype: null, pregnantOrBreastfeeding: false, ...overrides });
}

/** Default `AddProcedureModal` props — no procedures logged, empty callbacks. */
export function makeAddProcedureModalProps(
  overrides: Partial<AddProcedureModalProps> = {},
): AddProcedureModalProps {
  return {
    visible: true,
    procedures: [],
    onClose: jest.fn(),
    onSave: jest.fn(),
    ...overrides,
  };
}
