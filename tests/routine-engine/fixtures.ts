import type { SeasonMask } from '@/constants/rulesets/rulesetTypes';
import type {
  ActiveIngredientKey,
  FitzpatrickType,
  Product,
  ProductType,
  Routine,
  RoutineStep,
  SkinConcern,
  UserProcedureLog,
  UserProfile,
} from '@/types';
import type { EngineInput, RoutinePlan } from '@/utils/routineEngine/generate';

/**
 * Shared fixtures for the routine-engine integration suite (spec
 * docs/specs/2026-07-04-routine-engine.md §4/§9). Factory functions are
 * annotated with the real domain/engine types so prop drift fails `tsc`, not
 * just the test run (.claude/rules/testing.md).
 */

// A fixed instant used across suites so `getSkincareDateString`/`getElapsedDays`
// are deterministic. Noon UTC keeps the 04:00 skincare-day boundary out of play
// regardless of the host machine's timezone. 2026-07-04 is a Saturday (UTC dow 6).
export const NOW = new Date('2026-07-04T12:00:00Z');

let productIdCounter = 0;
export function resetFixtureCounters(): void {
  productIdCounter = 0;
  stepIdCounter = 0;
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  productIdCounter += 1;
  return {
    id: `product-${productIdCounter}`,
    name: `Product ${productIdCounter}`,
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    // Post-migration products always carry a source; same-reference
    // assertions rely on the backfill being a no-op for these fixtures.
    source: 'user_local',
    ...overrides,
  };
}

let stepIdCounter = 0;
export function makeRoutineStep(
  product: Product,
  overrides: Partial<RoutineStep> = {},
): RoutineStep {
  stepIdCounter += 1;
  return {
    id: `step-${stepIdCounter}`,
    productType: product.productType,
    productId: product.id,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

export function makeRoutine(
  timeOfDay: 'morning' | 'evening',
  steps: RoutineStep[],
  overrides: Partial<Routine> = {},
): Routine {
  return { id: `routine-${timeOfDay}`, name: timeOfDay, timeOfDay, steps, ...overrides };
}

export function makeProcedureLog(overrides: Partial<UserProcedureLog> = {}): UserProcedureLog {
  return {
    id: `proc-${Math.random().toString(36).slice(2)}`,
    procedureKey: 'chemical_peel_deep',
    datePerformed: '2026-07-04',
    status: 'rehab',
    deferralCount: 0,
    ...overrides,
  };
}

export function makeSeasonMask(
  season: SeasonMask['season'] = 'spring',
  source: SeasonMask['source'] = 'calendar',
): SeasonMask {
  return { season, source };
}

export function makeEngineInput(
  products: Product[],
  overrides: Partial<EngineInput> = {},
): EngineInput {
  return {
    products,
    procedures: [],
    profile: { fitzpatrick: null, concerns: [] },
    seasonMask: makeSeasonMask(),
    now: NOW,
    ...overrides,
  };
}

/** Full UserProfile factory for migration-pipeline (hydrate-composition) tests. */
export function makeFullProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'profile-1',
    gender: null,
    age: null,
    skinType: null,
    phototype: null,
    fitzpatrick: null,
    city: null,
    concerns: [],
    spfSensitivity: false,
    onboardingCompleted: true,
    individualDurationMonths: {},
    ...overrides,
  };
}

/** Converts a generated draft into saveable routines the same way a "Save for Both" commit would. */
function stepFromPlannedStep(planned: RoutinePlan['periods']['morning'][number], prefix: string): RoutineStep {
  return {
    id: `${prefix}-${planned.productId}`,
    productType: planned.productType,
    productId: planned.productId,
    hidden: false,
    scheduledDays: planned.scheduledDays,
  };
}

export function routinesFromPlan(plan: RoutinePlan): Routine[] {
  return [
    makeRoutine(
      'morning',
      plan.periods.morning.map((s) => stepFromPlannedStep(s, 'am')),
    ),
    makeRoutine(
      'evening',
      plan.periods.evening.map((s) => stepFromPlannedStep(s, 'pm')),
    ),
  ];
}

/** Routine schema semantics: [] = every day, otherwise the two arrays must share a weekday. */
export function daysOverlap(a: number[], b: number[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  return a.some((d) => b.includes(d));
}

// ─── Randomized-shelf property test support (spec §9) ───────────────────────

/** Deterministic seeded PRNG (mulberry32) — no real randomness, no flakiness. */
export function makeRng(seed: number): () => number {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const RANDOM_PRODUCT_TYPES: ProductType[] = [
  'cleanser',
  'toner',
  'serum',
  'gel',
  'moisturizer',
  'cream',
  'eye_cream',
  'oil',
  'spf',
];

const RANDOM_ACTIVE_KEYS: ActiveIngredientKey[] = [
  'retinoid',
  'aha',
  'bha',
  'pha',
  'vitamin_c_pure',
  'vitamin_c_derivative',
  'niacinamide',
  'benzoyl_peroxide',
  'azelaic_acid',
  'copper_peptides',
  'ceramides',
  'hyaluronic_acid',
  'panthenol',
  'cica',
];

const RANDOM_CONCERNS: SkinConcern[] = ['acne', 'wrinkles', 'hyperpigmentation', 'dryness'];

/**
 * Builds a random-but-known shelf: each product's tags are recorded alongside
 * it (`tagsById`) so property tests can check pairwise safety without
 * re-deriving facts through the engine's internal productFacts module.
 */
export function randomShelf(
  rng: () => number,
  size: number,
): { products: Product[]; tagsById: Map<string, ActiveIngredientKey[]> } {
  const products: Product[] = [];
  const tagsById = new Map<string, ActiveIngredientKey[]>();

  for (let i = 0; i < size; i += 1) {
    const productType = pick(rng, RANDOM_PRODUCT_TYPES);
    const tagCount = Math.floor(rng() * 3); // 0-2 tags
    const tags: ActiveIngredientKey[] = [];
    for (let t = 0; t < tagCount; t += 1) {
      const key = pick(rng, RANDOM_ACTIVE_KEYS);
      if (!tags.includes(key)) tags.push(key);
    }
    const addedDay = 1 + Math.floor(rng() * 27);
    const product = makeProduct({
      productType,
      activeTags: tags,
      usageTime: pick(rng, ['morning', 'evening', 'both'] as const),
      addedAt: `2026-0${1 + Math.floor(rng() * 6)}-${String(addedDay).padStart(2, '0')}`,
    });
    products.push(product);
    tagsById.set(product.id, tags);
  }

  return { products, tagsById };
}

export function randomFitzpatrick(rng: () => number): FitzpatrickType | null {
  const options: (FitzpatrickType | null)[] = [null, 1, 2, 3, 4, 5, 6];
  return pick(rng, options);
}

export function randomConcerns(rng: () => number): SkinConcern[] {
  const count = Math.floor(rng() * 3);
  const concerns: SkinConcern[] = [];
  for (let i = 0; i < count; i += 1) {
    const c = pick(rng, RANDOM_CONCERNS);
    if (!concerns.includes(c)) concerns.push(c);
  }
  return concerns;
}
