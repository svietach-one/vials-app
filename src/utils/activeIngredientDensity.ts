import type {
  ActiveIngredientKey,
  AdvisorySeverity,
  Product,
  Routine,
  RoutineStep,
  SkinConditionType,
} from '@/types';
import { getProductActiveKeys } from '@/utils/ingredientParser';
import { isScheduledOnDay } from '@/utils/routineSchedule';
import { CONDITION_MODIFIERS } from '@/utils/skinConditionModifiers';

/**
 * Active ingredient density insights (PRD v1.2 §5.2, US-28).
 *
 * Answers a question the pairwise matrix deliberately does not: what happens
 * when the SAME active shows up in two or more products in one period. That is
 * a dosing question, not a class collision, so it runs as an independent check
 * beside `detectConflicts()` and never feeds into it.
 *
 * Tiering is the point of the feature: duplicated humectants render nothing,
 * duplicated mild actives render a Cobalt insight ("this likely won't add
 * benefit"), and duplicated irritants render an Amber caution. Nothing here
 * blocks saving anything.
 *
 * Copy contract (US-26): DENSITY_MESSAGES is scanned by advisoryCopy.test.ts
 * against BANNED_ADVISORY_PHRASES.
 */

// ─── Taxonomy ─────────────────────────────────────────────────────────────────

/**
 * Spec-level ingredient groups (§5.2's shorthand). Coarser than this app's
 * canonical class keys on purpose: two exfoliating acids in one period are
 * "the same tag" for density purposes even when one is an AHA and the other a
 * BHA — the dose-stacking concern is the class of action, not the molecule.
 */
export type DensityGroup = 'RETI' | 'ACID' | 'VIT_C' | 'BPO' | 'AZA' | 'PEPT';

export type DensityTier = 'ignore' | 'insight' | 'warning';

/** Canonical keys making up each spec group. */
const GROUP_KEYS: Record<DensityGroup, ActiveIngredientKey[]> = {
  RETI: ['retinoid'],
  ACID: ['aha', 'bha', 'pha'],
  VIT_C: ['vitamin_c_pure', 'vitamin_c_derivative'],
  BPO: ['benzoyl_peroxide'],
  AZA: ['azelaic_acid'],
  PEPT: ['copper_peptides'],
};

/**
 * Tier per group (§5.2's table).
 *
 * `PEPT` sits in Insight rather than Ignore because this app's `PEPT` group is
 * specifically copper peptides, which carry a real (if mild) stacking
 * consideration that generic signal/neuro peptides do not — those, along with
 * every barrier/humectant group (NIAC, CERA, PANT, GLYC, ZPCA, HYAL) and the
 * inert classes (spf_filters, cica), are simply absent from GROUP_KEYS and
 * therefore produce no finding at all.
 */
export const TIER_MAP: Record<DensityGroup, Exclude<DensityTier, 'ignore'>> = {
  VIT_C: 'insight',
  AZA: 'insight',
  PEPT: 'insight',
  RETI: 'warning',
  ACID: 'warning',
  BPO: 'warning',
};

/** Rendered copy per group and tier. Insight copy must not read as a caution. */
export const DENSITY_MESSAGES: Record<DensityGroup, Record<'insight' | 'warning', string>> = {
  VIT_C: {
    insight:
      'Several products in this routine contain vitamin C. This likely will not add extra benefit.',
    warning:
      'Several products in this routine contain vitamin C. Consider using one of them at a time and see how your skin responds.',
  },
  AZA: {
    insight:
      'Several products in this routine contain azelaic acid. One is usually enough to get the benefit.',
    warning:
      'Several products in this routine contain azelaic acid. Consider keeping one and watching for tingling or dryness.',
  },
  PEPT: {
    insight:
      'Several products in this routine contain copper peptides. Layering them mainly means diminishing returns.',
    warning:
      'Several products in this routine contain copper peptides. Consider keeping one for now and monitoring your skin response.',
  },
  RETI: {
    insight:
      'Several products in this routine contain retinoids.',
    warning:
      'Multiple retinoid products are scheduled together. Irritation adds up faster than results — consider reducing frequency if your skin feels tight or flaky.',
  },
  ACID: {
    insight:
      'Several products in this routine contain exfoliating acids.',
    warning:
      'Multiple exfoliating products are scheduled together. Consider reducing frequency if irritation occurs.',
  },
  BPO: {
    insight:
      'Several products in this routine contain benzoyl peroxide.',
    warning:
      'Multiple benzoyl peroxide products are scheduled together. Consider keeping one, since dryness builds up faster than the benefit.',
  },
};

/** Advisory severity each tier renders at. */
const TIER_SEVERITY: Record<'insight' | 'warning', AdvisorySeverity> = {
  insight: 'low',
  warning: 'medium',
};

// ─── Findings ─────────────────────────────────────────────────────────────────

export type RoutinePeriod = Routine['timeOfDay'];

/**
 * One period's steps as the SCREEN sees them. Callers pass what is actually
 * rendered — clinically frozen steps have already left the visible list by
 * then (see RoutinesScreen's frozenStepIds), and a finding about a step the
 * user cannot see is a bug, not a warning.
 */
export interface PeriodSteps {
  period: RoutinePeriod;
  steps: RoutineStep[];
}

/** Splits routines into period step-lists, for callers holding whole routines. */
export function toPeriodSteps(routines: Routine[]): PeriodSteps[] {
  return routines.map((routine) => ({ period: routine.timeOfDay, steps: routine.steps }));
}

export interface DensityFinding {
  /** Stable list key: `${period}:${group}`. */
  id: string;
  period: RoutinePeriod;
  group: DensityGroup;
  tier: 'insight' | 'warning';
  severity: AdvisorySeverity;
  message: string;
  /** Names of the products sharing the group, in routine order. */
  productNames: string[];
  /** Conditions that escalated an insight into a warning (US-28). */
  escalatedBy: SkinConditionType[];
}

interface FindingOptions {
  /**
   * Restrict to steps scheduled on this weekday (0 = Sunday). Omitted = every
   * visible step, regardless of its day mask.
   */
  dayOfWeek?: number;
}

function visibleProducts(
  steps: RoutineStep[],
  products: Product[],
  options: FindingOptions,
): Product[] {
  const found: Product[] = [];
  for (const step of steps) {
    if (step.hidden || !step.productId) continue;
    if (options.dayOfWeek !== undefined && !isScheduledOnDay(step.scheduledDays, options.dayOfWeek)) {
      continue;
    }
    const product = products.find((p) => p.id === step.productId);
    if (!product || product.isHidden) continue;
    // Density counts PRODUCTS, not steps: the same product occupying two
    // steps of one period is a duplicate-step question, not a dose question.
    if (found.some((p) => p.id === product.id)) continue;
    found.push(product);
  }
  return found;
}

/** Which group a canonical key belongs to, or null when it is not tiered. */
function groupFor(key: ActiveIngredientKey): DensityGroup | null {
  for (const group of Object.keys(GROUP_KEYS) as DensityGroup[]) {
    if (GROUP_KEYS[group].includes(key)) return group;
  }
  return null;
}

/**
 * Density findings for the given routines, scoped per period: two products
 * sharing a group in the morning and one more in the evening produce one
 * morning finding, never a merged one (US-28 — periods are independent).
 *
 * Fires only at 2+ DISTINCT products carrying the group; one product matching
 * two keys of the same group (an AHA and a BHA in the same bottle) is still one
 * product and never triggers a finding.
 */
export function getActiveDensityFindings(
  periods: PeriodSteps[],
  products: Product[],
  options: FindingOptions = {},
): DensityFinding[] {
  const findings: DensityFinding[] = [];

  for (const { period, steps } of periods) {
    const scheduled = visibleProducts(steps, products, options);

    // group → product names carrying it (de-duplicated per product)
    const carriers = new Map<DensityGroup, string[]>();
    for (const product of scheduled) {
      const groups = new Set<DensityGroup>();
      for (const key of getProductActiveKeys(product)) {
        const group = groupFor(key);
        if (group) groups.add(group);
      }
      for (const group of groups) {
        const names = carriers.get(group);
        if (names) names.push(product.name);
        else carriers.set(group, [product.name]);
      }
    }

    for (const [group, productNames] of carriers) {
      if (productNames.length < 2) continue;
      const tier = TIER_MAP[group];
      findings.push({
        id: `${period}:${group}`,
        period,
        group,
        tier,
        severity: TIER_SEVERITY[tier],
        message: DENSITY_MESSAGES[group][tier],
        productNames,
        escalatedBy: [],
      });
    }
  }

  return findings;
}

/**
 * Escalates Insight-tier findings to Warning when a selected condition targets
 * the group (US-28). Same one-level, no-stacking rule as US-24 — several
 * matching conditions still escalate once, and a Warning-tier finding is
 * already at the cap and renders unchanged.
 *
 * Returns the input findings unchanged for `conditions === []` (US-27).
 */
export function applyConditionDensityModifiers(
  findings: DensityFinding[],
  conditions: SkinConditionType[],
): DensityFinding[] {
  const active = CONDITION_MODIFIERS.filter((m) => conditions.includes(m.condition));
  if (active.length === 0) return findings;

  return findings.map((finding) => {
    if (finding.tier === 'warning') return finding;

    const groupKeys = GROUP_KEYS[finding.group];
    const escalatedBy = active
      .filter((m) => groupKeys.some((key) => m.escalateTags.includes(key)))
      .map((m) => m.condition);
    if (escalatedBy.length === 0) return finding;

    return {
      ...finding,
      tier: 'warning',
      severity: TIER_SEVERITY.warning,
      message: DENSITY_MESSAGES[finding.group].warning,
      escalatedBy,
    };
  });
}
