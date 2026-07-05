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
 * ≈ weeks 1–2, phase 2 ≈ weeks 3–4, phase 3 from week 5. A product owned
 * long before tracking shipped lands directly in phase 3 (no retroactive
 * throttling).
 */
export function virtualApplicationCount(addedAt: string, now: Date = new Date()): number {
  const weeks = Math.floor(Math.max(0, getElapsedDays(addedAt, now)) / 7);
  return weeks <= 2 ? weeks * 2 : 4 + (weeks - 2) * 4;
}

/**
 * The application count the adaptation table runs on. Dynamic mode uses the
 * tracked counter; a product with no stats yet (pre-tracking shelf) and all
 * of fixed mode fall back to the virtual count.
 */
export function applicationCountFor(
  product: Product,
  stats: ProductApplicationStats[],
  cycleType: RoutineCycleType,
  now: Date = new Date(),
): number {
  if (cycleType === 'dynamic') {
    const entry = stats.find((s) => s.productId === product.id);
    if (entry) return entry.count;
  }
  return virtualApplicationCount(product.addedAt, now);
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
): AdaptationStatus | null {
  let status: AdaptationStatus | null = null;

  for (const { key } of facts.classes) {
    const config = ACTIVES_RULESET.classes[key]?.adaptation;
    if (!config) continue;

    const count = applicationCountFor(product, stats, cycleType, now);
    const phaseIndex = phaseIndexFor(config, count);
    const cap = config.phases[phaseIndex].maxDaysPerWeek;
    const candidate: AdaptationStatus = {
      phaseIndex,
      maxDaysPerWeek: cap,
      week: weekFor(phaseIndex, count),
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
): Map<string, AdaptationLimit> {
  const limits = new Map<string, AdaptationLimit>();
  for (const product of products) {
    const f = facts.get(product.id);
    if (!f) continue;
    const status = getAdaptationStatus(product, f, stats, cycleType, now);
    if (status?.maxDaysPerWeek !== undefined) {
      limits.set(product.id, {
        maxDaysPerWeek: status.maxDaysPerWeek,
        reasonCode: status.reasonCode,
      });
    }
  }
  return limits;
}
