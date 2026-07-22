import type { DecisionReasonCode } from '@/constants/decisionReasons';
import type { Period } from '@/constants/rulesets/rulesetTypes';
import type { ConflictSeverity, ProductType } from '@/types';

/**
 * Shared output types of the pipeline stages (research §3 step 8). Kept in
 * their own module so eligibility/resolve/mandates can share them without
 * circular imports; the RoutinePlan aggregate itself is assembled by the
 * generate entry point (FE-5).
 */

/** A product admitted into a period, pre-ordering. */
export interface PlannedStep {
  productId: string;
  productType: ProductType;
  /** 0 = Sunday … 6 = Saturday; empty = every day (Routine schema semantics). */
  scheduledDays: number[];
  /** Layering slot index (slotting.ts LAYERING_ORDER). */
  slotIndex: number;
  /** Admission score — kept for ordering ties and substitute ranking. */
  score: number;
  /** Product.addedAt, kept for stable ordering tiebreaks. */
  addedAt: string;
  /**
   * Contextual instruction resolved from shelf state at generation (e.g. a
   * pre-cleanse step followed by a cleanser). `null` = no note. Part of the
   * plan snapshot, so it is covered by the determinism property test.
   * makeStep always emits it (never undefined on a generated step).
   */
  stepNote?: string | null;
}

/** A product excluded with an explainable cause (dimmed "Paused until" rows). */
export interface FrozenItem {
  productId: string;
  reasonCode: DecisionReasonCode;
  /** Pair rule that froze it, when applicable. */
  ruleId?: string;
  /** Skincare date the freeze expires (clinical freezes only). */
  until?: string;
}

/** A mandated slot the shelf cannot satisfy (e.g. missing SPF). */
export interface PlaceholderSlot {
  period: Period;
  productTypes: ProductType[];
  reasonCode: DecisionReasonCode;
  /** Phototype 1–2 SPF mandates cannot be dismissed (research §2.4). */
  nonSkippable: boolean;
  /**
   * Finding severity when the mandate is unmet — from the source rule's own
   * declaration (e.g. seasons.json severity) or 'avoid' for non-skippable
   * mandates; merged placeholders keep the strictest.
   */
  severity: ConflictSeverity;
}

/**
 * A layering slot where more than one eligible product competed for admission
 * (routine-similar-product-priority, Story 2): `winnerProductId` is the one
 * `resolvePeriods` admitted; `alternatives` are the same-slot losers, ranked
 * best-first, recorded as full snapshots (tech design Assumption 1) so a
 * one-tap swap never re-runs eligibility/frequency-cap math.
 */
export interface SlotAlternative {
  winnerProductId: string;
  period: 'morning' | 'evening';
  slotIndex: number;
  alternatives: PlannedStep[];
}

export type DecisionAction =
  | 'admit'
  | 'relocate'
  | 'day_split'
  | 'freeze'
  | 'keep_with_note'
  | 'limit'
  | 'placeholder'
  /** Step-0 ranking exclusion (e.g. barrier_repair drops irritants) — a class
   * removed from treatmentClassRanking, not a product frozen or capped. */
  | 'goal_exclude'
  /** Skeleton selection put the product in reserve (phase-04): on the shelf,
   * healthy, just not needed — reasonCode says why. */
  | 'reserve'
  /** Advisory note with no scheduling effect (e.g. a rinse-off cleanser also
   * carries BHA) — distinct from keep_with_note, which records a tolerated
   * conflict. */
  | 'info';

/** A product deliberately left out of the routine by skeleton selection. */
export interface ReserveItem {
  productId: string;
  /** not_needed_for_goals | duplicate_function | cumulative_active_cap | … */
  reasonCode: DecisionReasonCode;
}

/** One explainable engine decision (research §1.8: invisible ≠ unaccountable). */
export interface DecisionLogEntry {
  action: DecisionAction;
  productId?: string;
  period?: Period;
  ruleId?: string;
  reasonCode?: DecisionReasonCode;
  detail?: string;
}
