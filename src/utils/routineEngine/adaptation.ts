import { ACTIVES_RULESET, type AdaptationConfig } from '@/constants/rulesets/rulesetTypes';
import type { Product, ProductApplicationStats, RoutineCycleType } from '@/types';
import type { ProductFacts } from '@/utils/routineEngine/productFacts';
import { getElapsedDays } from '@/utils/timeHelpers';

/**
 * Adaptation micro-dosing pipeline (research §2.6): per-product escalation
 * for irritating actives, keyed to the actual application count (dynamic
 * mode) or a deterministic virtual count derived from addedAt (fixed mode /
 * pre-tracking products). Downstream code never branches on the counting
 * source — both paths yield one count feeding one phase table.
 */

export interface AdaptationStatus {
  /** 0 = phase 1 (≤2×/week), 1 = phase 2 (every other night), 2 = standard rules. */
  phaseIndex: 0 | 1 | 2;
  /** Weekly cap while adapting; undefined once standard rules take over. */
  maxDaysPerWeek?: number;
  /** 1–4 for the FE-9 "⏳ Adaptation Phase (Week X of 4)" callout; null in phase 3. */
  week: 1 | 2 | 3 | 4 | null;
  reasonCode: string;
}

/** A per-product frequency cap the admission loop enforces. */
export interface AdaptationLimit {
  maxDaysPerWeek: number;
  reasonCode: string;
}

/**
 * Deterministic virtual count assuming the capped schedule was followed:
 * 2 applications/week for weeks 1–2, 4/week after — so phase 1 covers
 * ≈ weeks 1–2, phase 2 ≈ weeks 3–4, phase 3 from week 5.
 *
 * V2.1 phase-05 usage anchor: the clock starts at the product's FIRST
 * SCHEDULED date, not its shelf-add date. A product added long ago but never
 * scheduled has no anchor and starts at phase 1 — a bathroom-shelf backfill no
 * longer reads as months of prior use. (This intentionally reverses the V2
 * "no retroactive throttling / lands directly in phase 3" behavior — see
 * progress/routine-engine-v2-cosmetologist.md, 2026-07-17.)
 */
export function virtualApplicationCount(
  firstScheduledDate: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!firstScheduledDate) return 0; // never scheduled → phase 1
  const weeks = Math.floor(Math.max(0, getElapsedDays(firstScheduledDate, now)) / 7);
  return weeks <= 2 ? weeks * 2 : 4 + (weeks - 2) * 4;
}

/**
 * The application count the adaptation table runs on. Tracked check-ins win in
 * BOTH cycle modes (phase-05 §5.4 — a fixed-mode user who checks in has real
 * data); otherwise the virtual count anchors on the product's first scheduled
 * date. `firstScheduledDates` maps productId → skincare date (trackingStore).
 */
export function applicationCountFor(
  product: Product,
  stats: ProductApplicationStats[],
  cycleType: RoutineCycleType,
  now: Date = new Date(),
  firstScheduledDates: Record<string, string> = {},
): number {
  const entry = stats.find((s) => s.productId === product.id);
  if (entry) return entry.count;
  return virtualApplicationCount(firstScheduledDates[product.id], now);
}

/**
 * Phase regression after a break (phase-05 §5.2), for irritating actives only
 * (the caller gates on irritancy >= 3). Break measured from the last counted
 * application: > 28 days resets to phase 1; > 14 days drops one phase. Computed
 * from `(lastAppliedDate, now)` — never persisted, so the engine stays pure and
 * deterministic under an injected `now`.
 */
export function applyAdaptationRegression(
  phaseIndex: 0 | 1 | 2,
  lastAppliedDate: string | null | undefined,
  now: Date = new Date(),
): 0 | 1 | 2 {
  if (!lastAppliedDate) return phaseIndex; // no application → nothing to regress from
  const daysSince = getElapsedDays(lastAppliedDate, now);
  if (daysSince > 28) return 0;
  if (daysSince > 14) return Math.max(0, phaseIndex - 1) as 0 | 1 | 2;
  return phaseIndex;
}

/** Resolves the phase a count falls into (phases are ordered in the ruleset). */
function phaseIndexFor(config: AdaptationConfig, count: number): 0 | 1 | 2 {
  for (let i = 0; i < config.phases.length; i += 1) {
    const phase = config.phases[i];
    if (phase.throughApplication !== undefined && count <= phase.throughApplication) {
      return i as 0 | 1 | 2;
    }
  }
  return (config.phases.length - 1) as 0 | 1 | 2;
}

function weekFor(phaseIndex: 0 | 1 | 2, count: number): 1 | 2 | 3 | 4 | null {
  if (phaseIndex === 0) return count <= 2 ? 1 : 2;
  if (phaseIndex === 1) return count <= 6 ? 3 : 4;
  return null;
}

/**
 * Adaptation status of one product, or null when none of its classes adapt.
 * When several attributed classes adapt (rare), the tightest cap wins.
 */
export function getAdaptationStatus(
  product: Product,
  facts: ProductFacts,
  stats: ProductApplicationStats[],
  cycleType: RoutineCycleType,
  now: Date = new Date(),
  firstScheduledDates: Record<string, string> = {},
): AdaptationStatus | null {
  let status: AdaptationStatus | null = null;
  const lastApplied = stats.find((s) => s.productId === product.id)?.lastAppliedDate ?? null;
  // Regression only throttles strong actives (phase-05 §5.2 gates on irritancy >= 3).
  const regresses = facts.properties.irritancy >= 3;

  for (const { key } of facts.classes) {
    const config = ACTIVES_RULESET.classes[key]?.adaptation;
    if (!config) continue;

    const count = applicationCountFor(product, stats, cycleType, now, firstScheduledDates);
    const rawPhaseIndex = phaseIndexFor(config, count);
    const phaseIndex = regresses
      ? applyAdaptationRegression(rawPhaseIndex, lastApplied, now)
      : rawPhaseIndex;
    const cap = config.phases[phaseIndex].maxDaysPerWeek;
    const candidate: AdaptationStatus = {
      phaseIndex,
      maxDaysPerWeek: cap,
      // The week callout follows the resolved phase; a regressed product reads
      // as early in its (restarted) adaptation, which is the honest signal.
      week: weekFor(phaseIndex, phaseIndex === rawPhaseIndex ? count : 0),
      reasonCode: `adaptation_phase_${phaseIndex + 1}`,
    };

    const tighter =
      !status ||
      (candidate.maxDaysPerWeek !== undefined &&
        (status.maxDaysPerWeek === undefined || candidate.maxDaysPerWeek < status.maxDaysPerWeek));
    if (tighter) status = candidate;
  }

  return status;
}

/**
 * Per-product frequency caps for the admission loop (research §2.6: adaptation
 * caps join stacking caps in pipeline step 5). Phase 3 products produce no
 * entry. The phase-1 72 h rest gap is satisfied structurally: the engine's
 * 2-day picks prefer the Tue/Sat spread (resolve.ts pickSplitDays).
 */
export function collectAdaptationLimits(
  products: Product[],
  facts: Map<string, ProductFacts>,
  stats: ProductApplicationStats[],
  cycleType: RoutineCycleType,
  now: Date = new Date(),
  firstScheduledDates: Record<string, string> = {},
): Map<string, AdaptationLimit> {
  const limits = new Map<string, AdaptationLimit>();
  for (const product of products) {
    const f = facts.get(product.id);
    if (!f) continue;
    const status = getAdaptationStatus(product, f, stats, cycleType, now, firstScheduledDates);
    if (status?.maxDaysPerWeek !== undefined) {
      limits.set(product.id, {
        maxDaysPerWeek: status.maxDaysPerWeek,
        reasonCode: status.reasonCode,
      });
    }
  }
  return limits;
}

/**
 * Per-product tolerability for admission scoring (phase-05 §5.3): phaseIndex/2
 * → 0 | 0.5 | 1.0, so an adapted product outranks a new one of the same class.
 * Products with no adapting class are omitted (treated as 0 by the scorer).
 */
export function collectTolerability(
  products: Product[],
  facts: Map<string, ProductFacts>,
  stats: ProductApplicationStats[],
  cycleType: RoutineCycleType,
  now: Date = new Date(),
  firstScheduledDates: Record<string, string> = {},
): Map<string, number> {
  const tolerability = new Map<string, number>();
  for (const product of products) {
    const f = facts.get(product.id);
    if (!f) continue;
    const status = getAdaptationStatus(product, f, stats, cycleType, now, firstScheduledDates);
    if (status) tolerability.set(product.id, status.phaseIndex / 2);
  }
  return tolerability;
}
