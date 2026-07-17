/**
 * Type definitions and typed loaders for the static routine-engine rulesets
 * (actives / procedures / seasons). These describe the hand-edited JSON shapes
 * so the pure engine consumes them without `any`. Integrity tests co-located in
 * src/utils/routineEngine/ guard the JSON against drift from these types.
 *
 * Design-sanctioned location (tech-design FE-1): ruleset *schema* types live
 * here, next to the JSON, rather than in src/types/index.ts (which holds app
 * domain types). Domain keys that overlap (ActiveIngredientKey, ProductType,
 * ConflictSeverity, CosmeticProcedureKey) are imported, never re-declared.
 */
import activesRuleset from './actives.json';
import proceduresRuleset from './procedures.json';
import seasonsRuleset from './seasons.json';
import type {
  ActiveIngredientKey,
  ConflictSeverity,
  ProductType,
  SkinConcern,
} from '@/types';

// ─── Shared vocabulary ──────────────────────────────────────────────────────

/** Potency tier used in scoring and pair-rule exceptions. */
export type Potency = 'low' | 'medium' | 'high' | 'rx';

/** Skincare periods a rule can target. */
export type Period = 'am' | 'pm';

/** Calendar seasons (mirrors timeHelpers.getCurrentSeason). */
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

/** Closed action vocabulary shared by procedure and seasonal rules. */
export type RuleAction = 'freeze' | 'require' | 'prioritize' | 'limit';

/** Ordered resolution ladder steps for pair conflicts. */
export type ResolutionStrategy =
  | 'separate_periods'
  | 'separate_days'
  | 'freeze_lower_priority'
  | 'keep_with_note';

/**
 * Irritation tier, 0–5. The scale is the engine's mild/strong boundary — see
 * {@link isStrongActive} — so a class's value is a safety decision, not a label.
 *
 * | Level | Meaning | Classes |
 * |---|---|---|
 * | 0 | Inert / restorative | ceramides, panthenol, hyaluronic_acid, spf_filters |
 * | 1 | Mild actives | niacinamide, peptide_signal, peptide_neuro, vitamin_c_derivative, pha |
 * | 2 | Moderate | azelaic_acid, copper_peptides |
 * | 3 | Strong | aha, bha, vitamin_c_pure, retinoid @ low/medium potency |
 * | 4 | Very strong | benzoyl_peroxide, retinoid @ high/rx potency |
 * | 5 | Reserved for prescription-only classes (unused in v2.1) | — |
 *
 * Levels 3+ are "strong actives": they are the only classes the cumulative
 * exposure cap counts, and the only ones subject to break regression.
 */
export type IrritancyLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** Aggregatable class/product boolean-ish properties rules can target. */
export interface ActiveProperties {
  photosensitizing?: boolean;
  exfoliating?: boolean;
  /** Flat irritation tier; see {@link IrritancyLevel}. Overridden per-potency
   * by {@link ActiveProperties.irritancyByPotency} where declared. */
  irritancy?: number;
  /**
   * Per-potency irritancy override — a retinol and a tretinoin are not equally
   * irritating, and the flat tier cannot say so. Falls back to `irritancy` for
   * any potency not listed, and for products whose potency is unknown.
   */
  irritancyByPotency?: Partial<Record<Potency, number>>;
  barrierRepair?: boolean;
  lowPh?: boolean;
  spf?: boolean;
  /** Application-style flag (facial-massage balms) — used by procedure freezes. */
  massageRequired?: boolean;
}

/** Irritancy at a given potency: the per-potency override, else the flat tier, else 0. */
export function resolveIrritancy(props: ActiveProperties, potency?: Potency): number {
  const byPotency = potency ? props.irritancyByPotency?.[potency] : undefined;
  return byPotency ?? props.irritancy ?? 0;
}

/**
 * The single definition of the mild/strong boundary (spec phase-01 §1.2).
 * Strong actives are the only classes that declare a stacking cap, count
 * toward cumulative exposure, and regress after a break. Mild ones (peptides,
 * niacinamide, vitamin C derivatives, hydrators) are bioactive but not
 * irritating — the cap limits irritants, not bioactivity.
 *
 * Derived, never stored: there is no exemption list to drift out of sync.
 */
export function isStrongActive(props: ActiveProperties, potency?: Potency): boolean {
  return resolveIrritancy(props, potency) >= 3;
}

/**
 * Rule target selector. Property values may be a literal boolean or a
 * comparator string (e.g. "&gt;=3" for irritancy), resolved by the engine at
 * context-build time. `anyOf` unions nested selectors.
 */
export interface RuleTargets {
  properties?: Record<string, boolean | string | number>;
  classes?: ActiveIngredientKey[];
  productTypes?: ProductType[];
  anyOf?: RuleTargets[];
}

// ─── actives.json ─────────────────────────────────────────────────────────────

export interface ActiveClassMatcher {
  pattern: string;
  potency?: Potency;
}

export interface ActiveClassStacking {
  maxPerPeriod: number;
  sharedCapWith?: ActiveIngredientKey[];
}

/**
 * One adaptation escalation phase (research §2.6). Exactly one of
 * `throughApplication` (cap active up to and including this application
 * count) or `afterApplication` (standard rules take over past this count)
 * is set.
 */
export interface AdaptationPhase {
  throughApplication?: number;
  afterApplication?: number;
  maxDaysPerWeek?: number;
  /** Documented rest gap; satisfied by the engine's spread-day picks. */
  minRestHours?: number;
}

export interface AdaptationConfig {
  phases: AdaptationPhase[];
}

export interface ActiveClass {
  displayName: string;
  matchers: ActiveClassMatcher[];
  negativePatterns?: string[];
  properties: ActiveProperties;
  allowedPeriods: Period[];
  stacking?: ActiveClassStacking;
  cycleClass?: string;
  /** Micro-dosing escalation for irritating actives (research §2.6). */
  adaptation?: AdaptationConfig;
  /** Skin concerns this class addresses — drives the admission goal-match score. */
  concerns?: SkinConcern[];
  /**
   * Convention period for single-placement treatment products when both
   * periods are allowed (e.g. antioxidants in the morning). Treatments
   * without one default to 'pm'.
   */
  preferredPeriod?: Period;
}

export interface PairRuleException {
  whenPotencyAtMost?: Partial<Record<'a' | 'b', Potency>>;
  /** Softened outcome: a lower severity or a specific resolution strategy. */
  downgradeTo?: ConflictSeverity | ResolutionStrategy;
}

export interface PairRule {
  id: string;
  /** A single class key or an array (shared cap across several classes). */
  a: ActiveIngredientKey | ActiveIngredientKey[];
  b: ActiveIngredientKey | ActiveIngredientKey[];
  scope: 'same_period' | 'same_day' | 'anywhere';
  severity: ConflictSeverity;
  resolutions: ResolutionStrategy[];
  exceptions?: PairRuleException[];
  explanation: string;
  suggestion: string;
}

/**
 * Fitzpatrick severity/limit/mandate modifiers. Never add or remove rules —
 * they escalate pair severities, tighten limits, and add mandates when the
 * effective ruleset is built (pipeline step 2). `when`/`if` property values may
 * be comparator strings (e.g. "&gt;=2").
 */
export interface PhototypeEscalateEffect {
  effect: 'escalatePairSeverity';
  when: { bothProductsProperties: Record<string, boolean | string | number> };
  from: ConflictSeverity;
  to: ConflictSeverity;
  reasonCode: string;
}

export interface PhototypeTightenLimitEffect {
  effect: 'tightenLimit';
  targets: RuleTargets;
  maxDaysPerWeek: number;
  reasonCode: string;
}

export interface PhototypeAddMandateEffect {
  effect: 'addMandate';
  if?: { planContainsProperty?: string };
  then: { action: RuleAction; targets?: RuleTargets; period?: Period };
  nonSkippable?: boolean;
  reasonCode: string;
}

export type PhototypeEffect =
  | PhototypeEscalateEffect
  | PhototypeTightenLimitEffect
  | PhototypeAddMandateEffect;

export interface PhototypeModifier {
  /** Fitzpatrick types (1–6) this modifier applies to. */
  types: number[];
  effects: PhototypeEffect[];
}

export interface ActivesRuleset {
  version: string;
  legacyKeyMap: Record<string, ActiveIngredientKey>;
  classes: Record<string, ActiveClass>;
  pairRules: PairRule[];
  phototypeModifiers?: PhototypeModifier[];
}

// ─── Season mask (engine input) ─────────────────────────────────────────────

/**
 * Resolved season the engine applies, plus its provenance. Produced by the
 * weather service (FE-7) or the calendar fallback; the engine never branches on
 * `source` — it is carried for UI/debugging only.
 */
export interface SeasonMask {
  season: Season;
  source: 'weather' | 'calendar';
}

// ─── procedures.json ──────────────────────────────────────────────────────────

/** Day offset from datePerformed, or the 'rehabEnd' sentinel (resolved from the log). */
export type PhaseDay = number | 'rehabEnd';

export interface ProcedurePhase {
  fromDay: number;
  toDay: PhaseDay;
}

export interface ProcedureProductRule {
  phase: ProcedurePhase;
  action: RuleAction;
  targets: RuleTargets;
  /** Restricts a `require` mandate to one period. */
  period?: Period;
  reasonCode: string;
}

export interface ProcedureRules {
  /** Omitted for custom_default — resolved from the log's customRehabDays. */
  rehabDays?: number;
  productRules: ProcedureProductRule[];
}

export interface ProcedureRuleset {
  version: string;
  procedures: Record<string, ProcedureRules>;
}

// ─── seasons.json ─────────────────────────────────────────────────────────────

export interface SeasonRuleCondition {
  planContainsProperty?: string;
}

export interface SeasonRuleThen {
  action: RuleAction;
  targets?: RuleTargets;
  period?: Period;
  maxDaysPerWeek?: number;
}

export interface SeasonRule {
  id: string;
  seasons: Season[];
  if?: SeasonRuleCondition;
  then: SeasonRuleThen;
  severity?: ConflictSeverity;
  reasonCode: string;
}

export interface ClimateConfig {
  /** Weekly mean below coldBelowC → cold mask; above warmAboveC → warm mask. */
  thresholds: { coldBelowC: number; warmAboveC: number };
  checkIntervalDays: number;
  /** Cached weather older than this falls back to the calendar season. */
  staleAfterDays: number;
}

export interface SeasonRuleset {
  version: string;
  rules: SeasonRule[];
  climate: ClimateConfig;
}

// ─── Typed loaders ──────────────────────────────────────────────────────────

export const ACTIVES_RULESET = activesRuleset as unknown as ActivesRuleset;
export const PROCEDURES_RULESET = proceduresRuleset as unknown as ProcedureRuleset;
export const SEASONS_RULESET = seasonsRuleset as unknown as SeasonRuleset;
