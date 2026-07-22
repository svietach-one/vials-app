import { CLINICAL_RULES_DB } from '@/types';
import type { RehabNotice, UserProcedureLog } from '@/types';
import { ConflictEngine } from '@/utils/conflictEngine';
import { getProcedureDisplayName } from '@/utils/procedureLifespanHelpers';
import { getElapsedDays } from '@/utils/timeHelpers';

/** Rehab window length in days for any logged procedure. */
export function getRehabDays(proc: UserProcedureLog): number {
  if (proc.procedureKey === 'custom') return proc.customRehabDays ?? 0;
  return CLINICAL_RULES_DB[proc.procedureKey].rehabDays;
}

const barrierStatusFor = (currentDay: number, total: number): RehabNotice['barrierStatus'] =>
  // First half of the window the barrier is disrupted, second half sensitive.
  currentDay <= Math.ceil(total / 2) ? 'disrupted' : 'sensitive';

/**
 * One merged notice per procedure currently inside its rehab window, for the
 * Routines screen's rehab cards — the user sees exactly one notice per
 * procedure, never two about the same one.
 *
 * The acute lifestyle restrictions (no sauna, stay upright…) ride along inside
 * the same card, but ONLY during the disrupted (acute) phase — once the
 * barrier is merely sensitive they drop off, shrinking the card as relevance
 * passes. Custom procedures carry no clinical restrictions.
 *
 * Two logs of the SAME procedure type sharing an identical timeframe (same
 * current day + window length — e.g. two Botox sessions done together) merge
 * into one notice so near-duplicates never stack. The procedureKey is part of
 * the merge signature on purpose: without it, two DIFFERENT procedures that
 * happen to share a window length would fuse once both reach the sensitive
 * phase (where restrictions are equally empty), conflating distinct
 * procedures. Longest remaining window sorts first.
 */
export function buildRehabNotices(
  procedures: UserProcedureLog[],
  now: Date = new Date(),
): RehabNotice[] {
  interface Raw {
    proc: UserProcedureLog;
    currentDay: number;
    totalDays: number;
    barrierStatus: RehabNotice['barrierStatus'];
    restrictions: string[];
  }

  const raws: Raw[] = [];
  for (const proc of procedures) {
    if (proc.status === 'archived') continue;
    const total = getRehabDays(proc);
    if (total <= 0) continue;
    const elapsed = getElapsedDays(proc.datePerformed, now);
    if (elapsed < 0 || elapsed >= total) continue;

    const currentDay = elapsed + 1;
    const barrierStatus = barrierStatusFor(currentDay, total);
    const restrictions =
      barrierStatus === 'disrupted' && proc.procedureKey !== 'custom'
        ? ConflictEngine.getRehabRestrictions(proc.procedureKey)
        : [];
    raws.push({ proc, currentDay, totalDays: total, barrierStatus, restrictions });
  }

  // Group by procedure type + timeframe + restrictions (the merge rule).
  const groups = new Map<string, Raw[]>();
  const order: string[] = [];
  for (const raw of raws) {
    const signature = `${raw.proc.procedureKey}|${raw.currentDay}/${raw.totalDays}|${raw.restrictions.join('•')}`;
    const bucket = groups.get(signature);
    if (bucket) {
      bucket.push(raw);
    } else {
      groups.set(signature, [raw]);
      order.push(signature);
    }
  }

  const notices: RehabNotice[] = order.map((signature) => {
    const group = groups.get(signature)!;
    const names = [...new Set(group.map((r) => getProcedureDisplayName(r.proc)))];
    const head = group[0];
    return {
      key: group.map((r) => r.proc.id).join('+'),
      procedureName: names.join(' + '),
      currentDay: head.currentDay,
      totalDays: head.totalDays,
      barrierStatus: head.barrierStatus,
      restrictions: head.restrictions,
    };
  });

  // Dominant (longest remaining) window first.
  notices.sort((a, b) => b.totalDays - b.currentDay - (a.totalDays - a.currentDay));
  return notices;
}
