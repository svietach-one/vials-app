import { buildRoutineContext } from '@/utils/routineEngine/context';
import { applyEligibilityGates } from '@/utils/routineEngine/eligibility';
import type { EngineInput, RoutinePlan } from '@/utils/routineEngine/generate';
import { collectPrioritizeTargets } from '@/utils/routineEngine/mandates';
import { buildShelfFacts } from '@/utils/routineEngine/productFacts';
import {
  findViolationsAgainst,
  scoreCandidate,
  type AdmittedEntry,
} from '@/utils/routineEngine/resolve';
import { getSlotIndex, periodsForProduct } from '@/utils/routineEngine/slotting';

/**
 * Substitute entry point (research §3, mode "substitute"): the best eligible
 * shelf product of the same layering slot that is conflict-free against the
 * REST of the period's admitted set, ranked by the admission score.
 * Deterministic; null when nothing qualifies.
 */

export interface SubstituteResult {
  productId: string;
  score: number;
}

export function findSubstitute(
  plan: RoutinePlan,
  period: 'morning' | 'evening',
  productId: string,
  input: EngineInput,
): SubstituteResult | null {
  const target = plan.periods[period].find((s) => s.productId === productId);
  if (!target) return null;

  const now = input.now ?? new Date();
  const periodKey = period === 'morning' ? 'am' : 'pm';
  const facts = buildShelfFacts(input.products, now);
  const context = buildRoutineContext({
    procedures: input.procedures,
    profile: { fitzpatrick: input.profile.fitzpatrick },
    seasonMask: input.seasonMask,
    now,
  });
  const prioritize = collectPrioritizeTargets(context);

  const rest: AdmittedEntry[] = plan.periods[period]
    .filter((s) => s.productId !== productId)
    .flatMap((s) => {
      const f = facts.get(s.productId);
      return f ? [{ step: s, facts: f }] : [];
    });
  const inPlan = new Set(
    [...plan.periods.morning, ...plan.periods.evening].map((s) => s.productId),
  );

  let best: (SubstituteResult & { addedAt: string }) | null = null;
  for (const candidate of applyEligibilityGates(input.products, facts, context).eligible) {
    if (inPlan.has(candidate.id)) continue;
    if (getSlotIndex(candidate.productType) !== target.slotIndex) continue;

    const candidateFacts = facts.get(candidate.id);
    if (!candidateFacts) continue;
    if (!periodsForProduct(candidate.productType, candidateFacts).includes(periodKey)) continue;
    if (
      findViolationsAgainst(
        candidateFacts,
        target.scheduledDays,
        rest,
        context.effectiveRuleset.pairRules,
      ).length > 0
    ) {
      continue;
    }

    const score = scoreCandidate(
      candidate,
      candidateFacts,
      periodKey,
      input.profile.concerns,
      prioritize,
    );
    const beats =
      !best ||
      score > best.score ||
      (score === best.score &&
        (candidate.addedAt > best.addedAt ||
          (candidate.addedAt === best.addedAt && candidate.id < best.productId)));
    if (beats) best = { productId: candidate.id, score, addedAt: candidate.addedAt };
  }

  return best ? { productId: best.productId, score: best.score } : null;
}
