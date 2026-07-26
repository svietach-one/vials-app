import type {
  ActiveIngredientKey,
  AdvisorySeverity,
  ConflictResult,
  ConflictSeverity,
  CosmeticProcedureKey,
  Product,
  ProcedureLogKey,
  SkinConditionType,
} from '@/types';
import { getProductActiveKeys } from '@/utils/ingredientParser';

/**
 * Skin-condition risk modifiers (PRD v1.2 §4.2.2, US-23–US-27).
 *
 * Three optional, self-reported flags that make EXISTING warnings more
 * conservative — never more permissive, never blocking. This module is a
 * wrapper around the conflict engine's output plus one independent
 * single-ingredient check; it never edits the pairwise matrix, and every
 * exported function returns an empty / unchanged result for `conditions === []`
 * (US-27's no-op guarantee, enforced by the regression harness in
 * skinConditionModifiers.test.ts).
 *
 * Copy contract (US-26): every string in this file is scanned by
 * advisoryCopy.test.ts against BANNED_ADVISORY_PHRASES. Advisories describe
 * risk ("higher irritation risk", "consider introducing gradually") and never
 * use the word "conflict" for a single-ingredient finding.
 */

// ─── Severity scale bridging ──────────────────────────────────────────────────

/**
 * The one documented projection between the production two-level
 * {@link ConflictSeverity} and the v1.2 three-level {@link AdvisorySeverity}.
 * The matrix itself is never rewritten to the wider scale — see the
 * AdvisorySeverity docblock in src/types.
 */
export function toAdvisorySeverity(severity: ConflictSeverity): AdvisorySeverity {
  return severity === 'avoid' ? 'high' : 'medium';
}

/** Inverse projection, for callers that must hand a severity back to the engine. */
export function toConflictSeverity(severity: AdvisorySeverity): ConflictSeverity {
  return severity === 'high' ? 'avoid' : 'caution';
}

/**
 * Raises a severity by exactly one level, capped at 'high' (US-24). The single
 * escalation primitive shared by the condition layer and the density layer —
 * so "no stacking" is a property of the call site (called at most once per
 * finding), not of a table that could drift.
 */
export function escalate(severity: AdvisorySeverity): AdvisorySeverity {
  if (severity === 'low') return 'medium';
  return 'high';
}

// ─── Tag groups ───────────────────────────────────────────────────────────────

/**
 * PRD §4.2.2 writes risk in shorthand tag groups (RETI, ACID, VIT_C…); this
 * app's canonical key space (actives.json classes) is finer-grained. One
 * mapping, used by every table below, so a shorthand group can never mean two
 * different things in two places.
 */
const RETI: ActiveIngredientKey[] = ['retinoid'];
const ACID: ActiveIngredientKey[] = ['aha', 'bha', 'pha'];
const VIT_C: ActiveIngredientKey[] = ['vitamin_c_pure', 'vitamin_c_derivative'];
const BPO: ActiveIngredientKey[] = ['benzoyl_peroxide'];
const AZA: ActiveIngredientKey[] = ['azelaic_acid'];

// ─── Condition modifier table ─────────────────────────────────────────────────

/** One single-ingredient advisory template. */
export interface ConditionAdvisoryRule {
  /** Canonical keys that trigger this advisory. */
  tags: ActiveIngredientKey[];
  severity: AdvisorySeverity;
  /** Rendered body copy. Never uses the word "conflict" (US-24). */
  message: string;
}

export interface ConditionModifier {
  condition: SkinConditionType;
  /** Plain-language label used by the picker and by advisory row titles. */
  label: string;
  /**
   * Tags whose PAIRWISE conflicts escalate one level when this condition is
   * selected. A tag may be advisory-only (present below but not here) — e.g.
   * azelaic acid under eczema, which is a gradual-introduction note rather
   * than an irritation escalator.
   */
  escalateTags: ActiveIngredientKey[];
  advisories: ConditionAdvisoryRule[];
  /**
   * Documented "no penalty for" list (§4.2.2). Barrier-supporting ingredients
   * that must never produce an advisory under this condition — asserted in
   * tests so a future table edit cannot quietly start penalising them.
   */
  noPenaltyTags: ActiveIngredientKey[];
}

export const CONDITION_MODIFIERS: readonly ConditionModifier[] = [
  {
    condition: 'eczema',
    label: 'Eczema / atopic dermatitis',
    escalateTags: [...RETI, ...ACID, ...VIT_C, ...BPO],
    advisories: [
      {
        tags: RETI,
        severity: 'medium',
        message:
          'Retinoids carry a higher irritation risk on eczema-prone skin. Consider introducing this gradually and monitor how your skin responds.',
      },
      {
        tags: ACID,
        severity: 'medium',
        message:
          'Exfoliating acids can leave an already-compromised barrier more reactive. Consider spacing these out and watching for tightness or stinging.',
      },
      {
        tags: VIT_C,
        severity: 'medium',
        message:
          'Vitamin C can sting on eczema-prone skin. A lower-strength or buffered formula, applied every other day at first, is often better tolerated.',
      },
      {
        tags: BPO,
        severity: 'medium',
        message:
          'Benzoyl peroxide is drying and carries a higher irritation risk on eczema-prone skin. Short-contact use and a richer moisturiser afterwards may help.',
      },
      {
        tags: AZA,
        severity: 'low',
        message:
          'Azelaic acid is usually well tolerated on eczema-prone skin. Some people notice mild tingling at first — introducing it gradually helps.',
      },
    ],
    noPenaltyTags: ['ceramides', 'panthenol', 'glycerin_class', 'niacinamide'],
  },
  {
    condition: 'rosacea',
    label: 'Rosacea',
    escalateTags: [...RETI, ...ACID, ...BPO],
    advisories: [
      {
        tags: RETI,
        severity: 'medium',
        message:
          'Retinoids can trigger flushing and stinging on rosacea-prone skin. Consider starting at a low frequency and building up slowly.',
      },
      {
        tags: ACID,
        severity: 'medium',
        message:
          'Exfoliating acids often heighten redness on rosacea-prone skin. Consider reducing frequency if you notice more flushing than usual.',
      },
      {
        tags: BPO,
        severity: 'medium',
        message:
          'Benzoyl peroxide carries a higher irritation risk on rosacea-prone skin. Monitor your skin response and reduce frequency if redness increases.',
      },
    ],
    noPenaltyTags: ['niacinamide', 'azelaic_acid', 'ceramides', 'panthenol'],
  },
  {
    condition: 'seborrheic_dermatitis',
    /**
     * Not tag-based (§4.2.2): the only seborrheic check is a soft note on very
     * rich / occlusive product FORMATS, and this catalog has no texture or
     * occlusivity field to evaluate — `productType` describes a category, not a
     * formulation weight. Shipped as a documented no-op with an empty advisory
     * list rather than guessing from product type or adding a catalog field
     * under this task's scope (kickoff prompt, IMPLEMENTATION_PLAN Phase 8.3).
     * Selecting it is still recorded, so the check activates for existing users
     * the moment a texture/occlusivity field lands.
     */
    label: 'Seborrheic dermatitis',
    escalateTags: [],
    advisories: [],
    noPenaltyTags: ['niacinamide', 'azelaic_acid', 'ceramides', 'panthenol'],
  },
];

/**
 * Persistent picker disclaimer (US-23). Lives here rather than in the
 * component so every user-visible string this feature ships sits in one table
 * and is covered by the US-26 lint.
 */
export const CONDITION_DISCLAIMER =
  'These are self-reported flags, not a diagnosis. They only make Vials more careful with its warnings — they do not replace advice from a dermatologist.';

// ─── Pairwise severity escalation (US-24) ─────────────────────────────────────

/** A pairwise conflict plus the severity actually rendered for this user. */
export interface ModifiedConflict {
  /** The untouched engine result — `detectConflicts()` output is never edited. */
  result: ConflictResult;
  /** Severity to render, on the three-level advisory scale. */
  severity: AdvisorySeverity;
  /** True when a selected condition raised the severity. */
  escalated: boolean;
  /** Conditions that matched. Escalation still applies only once (no stacking). */
  escalatedBy: SkinConditionType[];
}

function modifiersFor(conditions: SkinConditionType[]): ConditionModifier[] {
  return CONDITION_MODIFIERS.filter((m) => conditions.includes(m.condition));
}

/**
 * Wraps `ConflictEngine.detectConflicts()` output with the severity each
 * conflict should RENDER at (US-24): one level up, capped at 'high', when a
 * selected condition targets either tag in the pair. Multiple matching
 * conditions escalate once, not once each.
 *
 * With `conditions === []` every entry comes back at its projected engine
 * severity with `escalated: false` — the engine's own output is never mutated.
 */
export function applyConditionSeverityModifiers(
  conflicts: ConflictResult[],
  conditions: SkinConditionType[],
): ModifiedConflict[] {
  const active = modifiersFor(conditions);

  return conflicts.map((result) => {
    const base = toAdvisorySeverity(result.rule.severity);
    const pairTags = [result.rule.itemA, result.rule.itemB];
    const escalatedBy = active
      .filter((m) => pairTags.some((tag) => m.escalateTags.includes(tag as ActiveIngredientKey)))
      .map((m) => m.condition);

    // One escalation regardless of how many conditions matched.
    const escalated = escalatedBy.length > 0 && base !== 'high';
    return {
      result,
      severity: escalatedBy.length > 0 ? escalate(base) : base,
      escalated,
      escalatedBy,
    };
  });
}

// ─── Single-ingredient advisories (US-24) ─────────────────────────────────────

/** One rendered `condition-advisory` row. */
export interface ConditionAdvisory {
  /** Stable de-dupe / list key — the tag, since rows are one-per-tag. */
  id: string;
  /**
   * Every selected condition that flagged this tag. One row covers all of
   * them: a user with eczema AND rosacea who schedules a retinoid gets one
   * note, not two near-identical ones — the same "escalate once, never stack"
   * principle US-24 applies to severity.
   */
  conditions: SkinConditionType[];
  /** Plain-language condition labels, for the row title. */
  conditionLabels: string[];
  tag: ActiveIngredientKey;
  /** Highest severity among the matching conditions. */
  severity: AdvisorySeverity;
  /**
   * Copy from the highest-severity matching condition; ties resolve to
   * CONDITION_MODIFIERS order, so the row is deterministic.
   */
  message: string;
  /** Products in the reviewed set that carry the tag. */
  productNames: string[];
}

const SEVERITY_RANK: Record<AdvisorySeverity, number> = { low: 0, medium: 1, high: 2 };

/**
 * Independent of any pairwise conflict: surfaces an advisory for each relevant
 * tag present in the reviewed products, even when it appears alone (US-24).
 *
 * Returns `[]` for an empty condition list — with no condition selected this
 * check produces nothing at all, for any input (US-27).
 */
export function getConditionRiskWarnings(
  products: Product[],
  conditions: SkinConditionType[],
): ConditionAdvisory[] {
  const active = modifiersFor(conditions);
  if (active.length === 0) return [];

  // Tag → the products carrying it, keyed by id so two products sharing a
  // name are still two products, in catalog order.
  const carriers = new Map<ActiveIngredientKey, Product[]>();
  for (const product of products) {
    for (const key of getProductActiveKeys(product)) {
      const carried = carriers.get(key);
      if (carried) {
        if (!carried.some((p) => p.id === product.id)) carried.push(product);
      } else {
        carriers.set(key, [product]);
      }
    }
  }

  // One row per tag, merging every condition that flagged it. Built in
  // CONDITION_MODIFIERS order so both the merge and the tie-break are stable.
  const byTag = new Map<ActiveIngredientKey, ConditionAdvisory>();
  for (const modifier of active) {
    for (const rule of modifier.advisories) {
      for (const tag of rule.tags) {
        const carried = carriers.get(tag);
        if (!carried || carried.length === 0) continue;

        const existing = byTag.get(tag);
        if (!existing) {
          byTag.set(tag, {
            id: tag,
            conditions: [modifier.condition],
            conditionLabels: [modifier.label],
            tag,
            severity: rule.severity,
            message: rule.message,
            productNames: carried.map((p) => p.name),
          });
          continue;
        }

        existing.conditions.push(modifier.condition);
        existing.conditionLabels.push(modifier.label);
        if (SEVERITY_RANK[rule.severity] > SEVERITY_RANK[existing.severity]) {
          existing.severity = rule.severity;
          existing.message = rule.message;
        }
      }
    }
  }

  return [...byTag.values()];
}

// ─── Recovery caution (US-25) ─────────────────────────────────────────────────

/**
 * Procedures treated as "aggressive" for the recovery caution. PRD §5.3 names
 * deep peel / laser resurfacing / microneedling; this catalog's nearest
 * equivalents are the deep peel, the energy-based lift, and the injectable
 * micro-wounding procedure. Botox and fillers are deliberately excluded —
 * US-25 requires the caution NOT to appear for them.
 */
export const AGGRESSIVE_PROCEDURES: readonly CosmeticProcedureKey[] = [
  'chemical_peel_deep',
  'smas_lifting',
  'mesotherapy',
];

/** True when a logged procedure key belongs to the aggressive set. */
export function isAggressiveProcedure(key: ProcedureLogKey): boolean {
  // Custom procedures carry no clinical classification and never qualify.
  return key !== 'custom' && AGGRESSIVE_PROCEDURES.includes(key);
}

/** Conditions that carry a recovery caution (§4.2.2: eczema and rosacea only). */
const RECOVERY_CONDITIONS: readonly SkinConditionType[] = ['eczema', 'rosacea'];

/** Copy-only additive lines. Never change a rehab/fading timeline (US-25). */
export const RECOVERY_CAUTIONS: Record<'rehab' | 'fading', string> = {
  rehab:
    'Recovery may take a bit longer than usual — keep an eye on how your skin responds.',
  fading:
    'Reactive skin can recover at its own pace — give it extra time before booking a repeat, and monitor how it settles.',
};

/**
 * One additive caution line for the rehab card / fading card, or `null` when
 * it does not apply: no eczema or rosacea selected, or the procedure is not in
 * the aggressive set. Copy-only — the caller renders it in the card's existing
 * caution style and changes nothing else.
 */
export function getRecoveryConditionCaution(
  conditions: SkinConditionType[],
  options: { aggressive: boolean; phase: 'rehab' | 'fading' },
): string | null {
  if (!options.aggressive) return null;
  if (!conditions.some((c) => RECOVERY_CONDITIONS.includes(c))) return null;
  return RECOVERY_CAUTIONS[options.phase];
}
