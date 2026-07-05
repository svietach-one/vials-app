import type { ConflictSeverity } from '@/types';
import type { Routine } from '@/types';
import { buildRoutineContext } from '@/utils/routineEngine/context';
import { applyEligibilityGates } from '@/utils/routineEngine/eligibility';
import { generatePlan, type EngineInput, type RoutinePlan } from '@/utils/routineEngine/generate';
import { applyMandates } from '@/utils/routineEngine/mandates';
import type { PlannedStep } from '@/utils/routineEngine/planTypes';
import { buildShelfFacts, type ProductFacts } from '@/utils/routineEngine/productFacts';
import { findViolationsAgainst, type AdmittedEntry } from '@/utils/routineEngine/resolve';
import { getSlotIndex } from '@/utils/routineEngine/slotting';

/**
 * Validate entry point (research §3, mode "validate"): runs the detection
 * stages over the user's SAVED routines without mutating anything, and diffs
 * the proposed regenerated plan against the saved state. Any avoid-level
 * finding lights the bottom "Optimize" strip — never a banner or modal.
 */

export interface ValidationFinding {
  severity: ConflictSeverity;
  reasonCode: string;
  productIds: string[];
  routineId?: string;
  ruleId?: string;
  explanation?: string;
  suggestion?: string;
  /** A userPinned step is involved — the engine will not auto-remove it. */
  pinned?: boolean;
}

export interface PlanDiffEntry {
  productId: string;
  kind: 'added' | 'removed' | 'moved' | 'frozen';
  from?: 'morning' | 'evening';
  to?: 'morning' | 'evening';
}

export interface ValidationResult {
  findings: ValidationFinding[];
  /** True when any finding is avoid-level — activates the Optimize strip. */
  hasBlockingFindings: boolean;
  /** The draft the Diff Mode preview shows against the saved state. */
  proposedPlan: RoutinePlan;
  diff: PlanDiffEntry[];
}

interface SavedEntry extends AdmittedEntry {
  routineId: string;
  pinned: boolean;
}

/** Saved steps of one period as conflict-checkable entries (hidden steps skipped). */
function savedEntries(
  routines: Routine[],
  timeOfDay: 'morning' | 'evening',
  facts: Map<string, ProductFacts>,
): SavedEntry[] {
  const out: SavedEntry[] = [];
  for (const routine of routines) {
    if (routine.timeOfDay !== timeOfDay) continue;
    for (const step of routine.steps) {
      if (step.hidden || !step.productId) continue;
      const f = facts.get(step.productId);
      if (!f) continue;
      out.push({
        routineId: routine.id,
        pinned: step.userPinned === true,
        facts: f,
        step: {
          productId: step.productId,
          productType: step.productType,
          scheduledDays: step.scheduledDays,
          slotIndex: getSlotIndex(step.productType),
          score: 0,
          addedAt: '',
        },
      });
    }
  }
  return out;
}

/** Pairwise conflicts within one period's saved steps, each pair reported once. */
function findPairFindings(
  entries: SavedEntry[],
  context: ReturnType<typeof buildRoutineContext>,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const ruleById = new Map(context.effectiveRuleset.pairRules.map((r) => [r.id, r]));

  for (let i = 1; i < entries.length; i += 1) {
    const current = entries[i];
    for (let j = 0; j < i; j += 1) {
      const partner = entries[j];
      for (const violation of findViolationsAgainst(
        current.facts,
        current.step.scheduledDays,
        [partner],
        context.effectiveRuleset.pairRules,
      )) {
        const rule = ruleById.get(violation.ruleId);
        findings.push({
          severity: violation.severity,
          reasonCode: violation.ruleId,
          ruleId: violation.ruleId,
          productIds: [partner.step.productId, current.step.productId],
          routineId: current.routineId,
          explanation: rule?.explanation,
          suggestion: rule?.suggestion,
          ...(current.pinned || partner.pinned ? { pinned: true } : {}),
        });
      }
    }
  }
  return findings;
}

/** Compares saved period membership against the proposed plan. */
function computeDiff(
  saved: { morning: Set<string>; evening: Set<string> },
  plan: RoutinePlan,
): PlanDiffEntry[] {
  const planSets = {
    morning: new Set(plan.periods.morning.map((s: PlannedStep) => s.productId)),
    evening: new Set(plan.periods.evening.map((s: PlannedStep) => s.productId)),
  };
  const frozenIds = new Set(plan.frozen.map((f) => f.productId));
  const diff: PlanDiffEntry[] = [];
  const handled = new Set<string>();
  const periods = ['morning', 'evening'] as const;

  for (const period of periods) {
    const other = period === 'morning' ? 'evening' : 'morning';
    for (const productId of saved[period]) {
      if (handled.has(productId) || planSets[period].has(productId)) continue;
      handled.add(productId);
      if (planSets[other].has(productId) && !saved[other].has(productId)) {
        diff.push({ productId, kind: 'moved', from: period, to: other });
      } else if (frozenIds.has(productId)) {
        diff.push({ productId, kind: 'frozen', from: period });
      } else {
        diff.push({ productId, kind: 'removed', from: period });
      }
    }
  }
  for (const period of periods) {
    for (const productId of planSets[period]) {
      if (saved[period].has(productId) || handled.has(productId)) continue;
      if (saved.morning.has(productId) || saved.evening.has(productId)) continue; // the moved side
      diff.push({ productId, kind: 'added', to: period });
    }
  }
  return diff;
}

export function validateRoutines(routines: Routine[], input: EngineInput): ValidationResult {
  const now = input.now ?? new Date();
  const facts = buildShelfFacts(input.products, now);
  const context = buildRoutineContext({
    procedures: input.procedures,
    profile: { fitzpatrick: input.profile.fitzpatrick },
    seasonMask: input.seasonMask,
    now,
  });

  const morning = savedEntries(routines, 'morning', facts);
  const evening = savedEntries(routines, 'evening', facts);
  const findings: ValidationFinding[] = [
    ...findPairFindings(morning, context),
    ...findPairFindings(evening, context),
  ];

  // Eligibility gates over products actually present in saved routines
  const savedIds = new Set([...morning, ...evening].map((e) => e.step.productId));
  const savedProducts = input.products.filter((p) => savedIds.has(p.id));
  for (const rejection of applyEligibilityGates(savedProducts, facts, context).rejections) {
    if (rejection.gate === 'hidden') continue;
    findings.push({
      severity: rejection.gate === 'clinical_freeze' ? 'avoid' : 'caution',
      reasonCode: rejection.reasonCode,
      productIds: [rejection.productId],
    });
  }

  // Unmet require mandates over the saved periods (missing SPF etc.)
  const mandates = applyMandates(
    { am: morning.map((e) => e.step), pm: evening.map((e) => e.step) },
    facts,
    context,
  );
  for (const placeholder of mandates.placeholders) {
    findings.push({
      severity: placeholder.severity,
      reasonCode: placeholder.reasonCode,
      productIds: [],
    });
  }

  const proposedPlan = generatePlan(input);
  const diff = computeDiff(
    {
      morning: new Set(morning.map((e) => e.step.productId)),
      evening: new Set(evening.map((e) => e.step.productId)),
    },
    proposedPlan,
  );

  return {
    findings,
    hasBlockingFindings: findings.some((f) => f.severity === 'avoid'),
    proposedPlan,
    diff,
  };
}
