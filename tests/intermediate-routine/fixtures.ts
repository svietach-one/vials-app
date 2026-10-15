/**
 * Shared fixtures for the intermediate-routine ("Balanced" style) suite.
 * Spec: docs/specs/intermediate-routine.md (Status: DRAFT when these were written)
 * Tech design: docs/tech-design/intermediate-routine.md
 *
 * Every factory is annotated with the REAL types so drift fails `tsc`
 * (.claude/rules/testing.md). Interfaces that do not exist yet are imported from
 * the module the tech design assigns them to, so `tsc` points at exactly the
 * work the engineer still owes. The complete list of such references:
 *
 *   - `RoutineDepth`                    @/types                     (FE-1)
 *   - `EngineInput.depth`               generate.ts                 (FE-4)  -> makeDepthInput below
 *   - `'enzyme_exfoliant'` as an ActiveIngredientKey                (FE-6)  -> ENZYME_TAG below
 *   - `'outside_routine_depth'` etc. as DecisionReasonCode          (FE-4/6)-> REASON below
 *   - `@/constants/routineDepth`        copy + default constant     (FE-1)
 *   - `@/utils/routineLeftOut`          buildLeftOutItems/LeftOutItem (FE-9)
 *
 * Each of those is referenced from ONE place in this file where possible, so a
 * single engineer change clears the type error.
 */
import { ACTIVES_RULESET } from '@/constants/rulesets/rulesetTypes';
import type { DecisionReasonCode } from '@/constants/decisionReasons';
import type {
  ActiveIngredientKey,
  FitzpatrickType,
  Product,
  ProductType,
  RoutineDepth,
  SkinGoal,
  UserProcedureLog,
} from '@/types';
import type { EngineInput, RoutinePlan } from '@/utils/routineEngine/generate';
import type { PlannedStep } from '@/utils/routineEngine/planTypes';
import type { LeftOutItem } from '@/utils/routineLeftOut';
import {
  daysOverlap,
  makeEngineInput,
  makeProcedureLog,
  makeProduct,
  makeRng,
  makeSeasonMask,
  NOW,
} from '../routine-engine/fixtures';

export { daysOverlap, NOW, makeRng, makeSeasonMask, makeEngineInput };
export { resetFixtureCounters, routinesFromPlan, makeRoutine, makeRoutineStep } from '../routine-engine/fixtures';

// ─── Intended-interface shims (single reference points) ──────────────────────

/** Both routine styles, Essential first. */
export const DEPTHS: RoutineDepth[] = ['essential', 'balanced'];

/** Enzyme exfoliant active class key (FE-6). Not yet in ActiveIngredientKey. */
export const ENZYME_TAG = 'enzyme_exfoliant' as const satisfies ActiveIngredientKey;

/** Typed reason-code literal: drift in a code name fails `tsc`, not just the run. */
export function REASON(code: DecisionReasonCode): DecisionReasonCode {
  return code;
}

/** EngineInput with the new `depth` field (FE-4). The ONLY place tests set it. */
export function makeDepthInput(
  products: Product[],
  depth: RoutineDepth,
  overrides: Partial<EngineInput> = {},
): EngineInput {
  return { ...makeEngineInput(products, overrides), depth };
}

// ─── Reference shelves (spec §4) ─────────────────────────────────────────────

export function shelfProduct(id: string, name: string, productType: ProductType, extra: Partial<Product> = {}): Product {
  return makeProduct({ id, name, productType, usageTime: 'both', addedAt: '2026-01-01', ...extra });
}

/** R9 = foam cleanser, micellar water, cream, SPF, toner, eye cream, essence, oil, ampoule. */
export const R9 = {
  foam: 'r9-foam',
  micellar: 'r9-micellar',
  cream: 'r9-cream',
  spf: 'r9-spf',
  toner: 'r9-toner',
  eye: 'r9-eye',
  essence: 'r9-essence',
  oil: 'r9-oil',
  ampoule: 'r9-ampoule',
} as const;

export function makeR9(): Product[] {
  return [
    shelfProduct(R9.foam, 'Foam Cleanser', 'cleanser'),
    shelfProduct(R9.micellar, 'Micellar Water', 'makeup_remover'),
    shelfProduct(R9.cream, 'Daily Cream', 'moisturizer'),
    shelfProduct(R9.spf, 'Daily SPF', 'spf'),
    shelfProduct(R9.toner, 'Hydrating Toner', 'toner'),
    shelfProduct(R9.eye, 'Eye Cream', 'eye_cream'),
    shelfProduct(R9.essence, 'Essence', 'essence'),
    shelfProduct(R9.oil, 'Face Oil', 'oil'),
    shelfProduct(R9.ampoule, 'Ampoule', 'ampoule'),
  ];
}

/** S3 = cleanser, cream, SPF. */
export const S3 = { cleanser: 's3-cleanser', cream: 's3-cream', spf: 's3-spf' } as const;

export function makeS3(): Product[] {
  return [
    shelfProduct(S3.cleanser, 'Gentle Cleanser', 'cleanser'),
    shelfProduct(S3.cream, 'Plain Cream', 'moisturizer'),
    shelfProduct(S3.spf, 'Plain SPF', 'spf'),
  ];
}

export const ENZYME_ID = 'e4-enzyme';

/** An enzyme powder typed "cleanser" and tagged as an enzyme exfoliant (spec E4). */
export function makeEnzymePowder(overrides: Partial<Product> = {}): Product {
  return shelfProduct(ENZYME_ID, 'Papaya Enzyme Powder', 'cleanser', { activeTags: [ENZYME_TAG], ...overrides });
}

/** E4 = S3 + an enzyme powder. */
export function makeE4(): Product[] {
  return [...makeS3(), makeEnzymePowder()];
}

/** A deep chemical peel logged on `datePerformed`, in rehab (exfoliants frozen). */
export function makeProcedureLogForPeel(datePerformed: string): UserProcedureLog {
  return makeProcedureLog({ procedureKey: 'chemical_peel_deep', datePerformed, status: 'rehab' });
}

/** A LeftOutItem (FE-9). Typed against the real interface so shape drift fails `tsc`. */
export function makeLeftOutItem(overrides: Partial<LeftOutItem> & Pick<LeftOutItem, 'productId' | 'kind'>): LeftOutItem {
  return { reasonCode: null, ...overrides };
}

// ─── Plan readers ────────────────────────────────────────────────────────────

export function ids(steps: PlannedStep[]): string[] {
  return steps.map((s) => s.productId);
}

export function reserveIds(plan: RoutinePlan): string[] {
  return plan.reserve.map((r) => r.productId).sort();
}

/** Gap placeholders as "am:toner" strings, in plan order. */
export function gapKeys(plan: RoutinePlan): string[] {
  return plan.placeholders.map((p) => `${p.period}:${p.productTypes[0]}`);
}

/** Days per week a step runs ([] = every day). */
export function daysPerWeek(step: PlannedStep): number {
  return step.scheduledDays.length === 0 ? 7 : step.scheduledDays.length;
}

export function stepFor(plan: RoutinePlan, productId: string, period: 'morning' | 'evening'): PlannedStep | undefined {
  return plan.periods[period].find((s) => s.productId === productId);
}

/** Every product id the plan accounts for in any bucket. */
export function accountedIds(plan: RoutinePlan): Set<string> {
  return new Set([
    ...plan.periods.morning.map((s) => s.productId),
    ...plan.periods.evening.map((s) => s.productId),
    ...plan.frozen.map((f) => f.productId),
    ...plan.reserve.map((r) => r.productId),
    ...(plan.slotAlternatives ?? []).flatMap((a) => a.alternatives.map((s) => s.productId)),
  ]);
}

// ─── Seeded shelves ──────────────────────────────────────────────────────────

const TAGS: ActiveIngredientKey[] = [
  'retinoid', 'aha', 'bha', 'pha', 'vitamin_c_pure', 'vitamin_c_derivative', 'niacinamide',
  'benzoyl_peroxide', 'azelaic_acid', 'copper_peptides', 'ceramides', 'hyaluronic_acid', 'panthenol', 'cica',
];
const GOALS: SkinGoal[] = ['maintenance', 'acne', 'pigmentation', 'aging', 'dehydration', 'barrier_repair', 'oil_control'];
const FITZ: (FitzpatrickType | null)[] = [null, 1, 2, 3, 4, 5, 6];
const SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;
const USAGE = ['morning', 'evening', 'both', 'both', 'both'] as const;
/** Weighted so toner / eye cream / cleansers appear often enough to matter. */
const SWEEP_TYPES: ProductType[] = [
  'cleanser', 'cleanser', 'makeup_remover', 'toner', 'toner', 'eye_cream', 'eye_cream', 'serum', 'gel',
  'moisturizer', 'cream', 'balm', 'oil', 'essence', 'ampoule', 'spf', 'mask', 'peeling', 'lotion',
];
const SWEEP_NAMES: Record<string, string[]> = {
  balm: ['Barrier Balm', 'Lip Balm', 'Hair Balm', 'Cleansing Balm'],
};

export interface SweepShelf {
  input: EngineInput;
  tagsById: Map<string, ActiveIngredientKey[]>;
}

export interface SweepOptions {
  /** Salt ~15% of products with the enzyme tag (needs FE-6 for the tag to mean anything). */
  enzyme?: boolean;
  /** Seed namespace so different suites do not share corpora. */
  salt?: number;
}

/**
 * A random-but-known shelf plus profile/season/procedure/override variety.
 * Deterministic (mulberry32). `tagsById` records what each product carries so a
 * property can check pair safety WITHOUT re-deriving facts through the engine.
 */
export function buildSweepShelf(seed: number, depth: RoutineDepth, opts: SweepOptions = {}): SweepShelf {
  const rng = makeRng(seed * 7919 + 13 + (opts.salt ?? 0) * 100003);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rng() * a.length)];
  const size = 3 + Math.floor(rng() * 11);
  const products: Product[] = [];
  const tagsById = new Map<string, ActiveIngredientKey[]>();
  for (let i = 0; i < size; i += 1) {
    const productType = pick(SWEEP_TYPES);
    const tags: ActiveIngredientKey[] = [];
    const tagCount = Math.floor(rng() * 3);
    for (let t = 0; t < tagCount; t += 1) {
      const k = pick(TAGS);
      if (!tags.includes(k)) tags.push(k);
    }
    if (opts.enzyme && rng() < 0.15) tags.push(ENZYME_TAG);
    const id = `sw${opts.salt ?? 0}-${seed}-${i}`;
    const names = SWEEP_NAMES[productType];
    products.push(
      makeProduct({
        id,
        name: names ? pick(names) : `P${seed}-${i}`,
        productType,
        activeTags: tags,
        usageTime: pick(USAGE),
        isHidden: rng() < 0.05,
        addedAt: `2026-0${1 + Math.floor(rng() * 6)}-${String(1 + Math.floor(rng() * 27)).padStart(2, '0')}`,
      }),
    );
    tagsById.set(id, tags);
  }
  const procedures: UserProcedureLog[] = rng() < 0.1 ? [makeProcedureLog({ datePerformed: '2026-07-04' })] : [];
  const overridePool = products.map((p) => p.id);
  const userOverrides = rng() < 0.15 ? [pick(overridePool)] : undefined;
  const input = makeDepthInput(products, depth, {
    procedures,
    userOverrides,
    profile: {
      fitzpatrick: pick(FITZ),
      concerns: [],
      primaryGoal: pick(GOALS),
      secondaryGoal: rng() < 0.2 ? pick(GOALS) : null,
      pregnantOrBreastfeeding: rng() < 0.08,
    },
    seasonMask: makeSeasonMask(pick(SEASONS)),
  });
  return { input, tagsById };
}

const PROMOTION_OTHER_TYPES = [
  'serum', 'serum', 'gel', 'cream', 'toner', 'toner', 'eye_cream', 'eye_cream', 'essence', 'moisturizer', 'lotion', 'balm',
] as const;

/**
 * Same SHAPE as tests/routine-engine/promotion-safety-sweep.test.ts (a pre_cleanse
 * step on every shelf, 2-5 cleansers, active-bearing products to collide with) but
 * with toner and eye cream weighted in, because those are the steps Balanced ADDS.
 */
export function buildPromotionShapedShelf(seed: number, depth: RoutineDepth): SweepShelf {
  const rng = makeRng(seed * 104729 + 7);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rng() * a.length)];
  const products: Product[] = [];
  const tagsById = new Map<string, ActiveIngredientKey[]>();
  const add = (productType: ProductType, max: number, usageTime: Product['usageTime']) => {
    const tags: ActiveIngredientKey[] = [];
    const n = productType === 'makeup_remover' ? 0 : Math.floor(rng() * (max + 1));
    for (let i = 0; i < n; i += 1) {
      const t = pick(TAGS);
      if (!tags.includes(t)) tags.push(t);
    }
    const id = `pr${seed}-${products.length}`;
    products.push(
      makeProduct({
        id,
        name: `PR${seed}-${products.length}`,
        productType,
        activeTags: tags,
        usageTime,
        addedAt: `2026-0${1 + Math.floor(rng() * 6)}-${String(1 + Math.floor(rng() * 27)).padStart(2, '0')}`,
      }),
    );
    tagsById.set(id, tags);
  };
  add('makeup_remover', 0, 'both');
  const cleansers = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < cleansers; i += 1) add('cleanser', 2, pick(USAGE));
  const others = 2 + Math.floor(rng() * 5);
  for (let i = 0; i < others; i += 1) add(pick(PROMOTION_OTHER_TYPES), 2, pick(USAGE));
  const input = makeDepthInput(products, depth, {
    profile: {
      fitzpatrick: pick(FITZ),
      concerns: [],
      primaryGoal: pick(GOALS),
      secondaryGoal: null,
    },
    seasonMask: makeSeasonMask(pick(SEASONS)),
  });
  return { input, tagsById };
}

// ─── Independent safety checkers (do not call the engine's own validator) ────

function sideKeys(side: ActiveIngredientKey | ActiveIngredientKey[]): ActiveIngredientKey[] {
  return Array.isArray(side) ? side : [side];
}

const AVOID_PAIRS = ACTIVES_RULESET.pairRules
  .filter((r) => r.severity === 'avoid')
  .map((r) => ({ id: r.id, a: sideKeys(r.a), b: sideKeys(r.b) }));

/**
 * Avoid-level pairs scheduled in the same period on a shared day, computed from
 * tags + scheduledDays only. Phototype escalation only ever ADDS avoid pairs, so
 * the base list is a valid floor (same argument as determinism-and-safety.test.ts).
 */
export function avoidPairOffences(plan: RoutinePlan, tagsById: Map<string, ActiveIngredientKey[]>): string[] {
  const out: string[] = [];
  for (const [label, steps] of [['morning', plan.periods.morning], ['evening', plan.periods.evening]] as const) {
    for (let i = 0; i < steps.length; i += 1) {
      for (let j = i + 1; j < steps.length; j += 1) {
        const ti = tagsById.get(steps[i].productId) ?? [];
        const tj = tagsById.get(steps[j].productId) ?? [];
        for (const pair of AVOID_PAIRS) {
          const ab = pair.a.some((k) => ti.includes(k)) && pair.b.some((k) => tj.includes(k));
          const ba = pair.b.some((k) => ti.includes(k)) && pair.a.some((k) => tj.includes(k));
          if ((ab || ba) && daysOverlap(steps[i].scheduledDays, steps[j].scheduledDays)) {
            out.push(`${label}: ${pair.id} ${steps[i].productId}&${steps[j].productId}`);
          }
        }
      }
    }
  }
  return out;
}

function collectReasonCodes(node: unknown, into: Set<string>): void {
  if (Array.isArray(node)) node.forEach((n) => collectReasonCodes(n, into));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'reasonCode' && typeof v === 'string') into.add(v);
      else collectReasonCodes(v, into);
    }
  }
}

/**
 * Reason codes of HARD eligibility gates: a product frozen by one of these is
 * out of BOTH periods. Pair-rule / cap freezes are per period and are legal
 * alongside a step in the other period (tech design §3 "latent gap"), so they
 * are deliberately excluded here.
 */
export function hardGateReasonCodes(): Set<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const procedures = require('@/constants/rulesets/procedures.json');
  const codes = new Set<string>(['pregnancy_blocked', 'pao_expired', 'no_allowed_period']);
  collectReasonCodes(procedures, codes);
  return codes;
}

/** Hard-gated products that nevertheless appear in a scheduled period. */
export function hardGateViolations(plan: RoutinePlan): string[] {
  const hard = hardGateReasonCodes();
  const scheduled = new Set([...plan.periods.morning, ...plan.periods.evening].map((s) => s.productId));
  return plan.frozen
    .filter((f) => hard.has(f.reasonCode) && scheduled.has(f.productId))
    .map((f) => `${f.productId} frozen by ${f.reasonCode} but scheduled`);
}

// ─── Golden Essential corpus ─────────────────────────────────────────────────

/** Rewrites the one relabelled reserve reason and drops the version stamp, so a
 *  plan produced AFTER this task compares against one captured BEFORE it. */
export function normaliseEssentialPlan(plan: RoutinePlan): unknown {
  const text = JSON.stringify(plan).replace(/outside_routine_depth/g, 'not_needed_for_goals');
  const parsed = JSON.parse(text) as Record<string, unknown>;
  delete parsed.rulesetVersion;
  return parsed;
}

export function reviveEngineInput(raw: EngineInput & { now?: Date | string }): EngineInput {
  return { ...raw, now: raw.now ? new Date(raw.now) : undefined };
}
