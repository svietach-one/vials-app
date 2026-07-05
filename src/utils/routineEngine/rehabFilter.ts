import { CLINICAL_RULES_DB } from '@/types';
import type {
  ActiveIngredientKey,
  Product,
  RehabWidgetState,
  Routine,
  TreatmentZone,
  UserProcedureLog,
} from '@/types';
import { getProductActiveKeys } from '@/utils/ingredientParser';
import { getProcedureDisplayName } from '@/utils/procedureLifespanHelpers';
import { getElapsedDays } from '@/utils/timeHelpers';

/**
 * Active classes masked during any rehab window: photosensitizing and
 * exfoliating actives that a disrupted barrier cannot tolerate. Will migrate
 * to property-based targeting (photosensitizing/exfoliating flags) once the
 * rulesets JSON ships; the key set is the current-vocabulary equivalent.
 */
export const REHAB_MASKED_ACTIVE_KEYS: ReadonlySet<ActiveIngredientKey> = new Set([
  'retinoid',
  'aha',
  'bha',
  'benzoyl_peroxide',
]);

/**
 * All routines are face routines in Phase 1 — products and routine steps
 * carry no zone information yet. A rehab window scoped to other zones
 * (e.g. a neck-only peel) therefore never masks the routine.
 */
const ROUTINE_ZONE: TreatmentZone = 'face';

const DEFAULT_ZONES: TreatmentZone[] = ['face'];

/** Rehab window length in days for any logged procedure. */
export function getRehabDays(proc: UserProcedureLog): number {
  if (proc.procedureKey === 'custom') return proc.customRehabDays ?? 0;
  return CLINICAL_RULES_DB[proc.procedureKey].rehabDays;
}

/**
 * Derives the top-anchored rehab widget state from procedure logs.
 * Returns null when no procedure has remaining rehab days — including
 * procedures whose long-term effect is still active (Botox month 2 belongs
 * to the Clinic timeline, not the daily Routines screen). With overlapping
 * rehab windows the one ending last wins (its mask covers the union).
 */
export function buildRehabWidgetState(
  procedures: UserProcedureLog[],
  now: Date = new Date(),
): RehabWidgetState | null {
  let best: { proc: UserProcedureLog; elapsed: number; total: number } | null = null;

  for (const proc of procedures) {
    if (proc.status === 'archived') continue;
    const total = getRehabDays(proc);
    if (total <= 0) continue;

    const elapsed = getElapsedDays(proc.datePerformed, now);
    // Day 0 (procedure day) through day total-1 are inside the window;
    // on day `total` the window has ended and the widget self-destructs.
    if (elapsed < 0 || elapsed >= total) continue;

    const remaining = total - elapsed;
    if (!best || remaining > best.total - best.elapsed) {
      best = { proc, elapsed, total };
    }
  }

  if (!best) return null;

  const currentDay = best.elapsed + 1;

  return {
    procedureName: getProcedureDisplayName(best.proc),
    currentDay,
    totalDays: best.total,
    // First half of the window the barrier is disrupted, second half sensitive
    barrierStatus: currentDay <= Math.ceil(best.total / 2) ? 'disrupted' : 'sensitive',
    affectedZones: best.proc.affectedZones ?? DEFAULT_ZONES,
  };
}

/**
 * Render-time projection: masks steps whose products carry rehab-restricted
 * actives while a rehab window covers the routine's zone. Returns the input
 * routine untouched (same reference) when nothing applies — never mutates
 * and never persists; the widget explains the masked items, so nothing is
 * hidden silently.
 */
export function applyRehabFilter(
  routine: Routine,
  activeRehab: RehabWidgetState | null,
  products: Product[],
): Routine {
  if (!activeRehab) return routine;
  if (!activeRehab.affectedZones.includes(ROUTINE_ZONE)) return routine;

  const steps = routine.steps.filter((step) => {
    if (!step.productId) return true;
    const product = products.find((p) => p.id === step.productId);
    if (!product) return true;
    return !getProductActiveKeys(product).some((key) => REHAB_MASKED_ACTIVE_KEYS.has(key));
  });

  if (steps.length === routine.steps.length) return routine;
  return { ...routine, steps };
}
