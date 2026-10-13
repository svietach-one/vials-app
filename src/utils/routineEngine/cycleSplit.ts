/**
 * Pure day-assignment logic for an accepted cycle-class rivalry
 * (day-split-alternation, tech design FE-3). `resolve.ts`'s admission loop
 * calls this instead of `pickSplitDays`/`attemptDaySplit` for a registered
 * `cycleSplitPairs` violation: those two functions were hand-traced during
 * planning to independently compute the SAME [Tue, Sat] preferred days for
 * two candidates capped the same way, which collides rather than splits (see
 * progress/day-split-alternation.md). This module never reads engine state —
 * both caps are supplied by the caller, already resolved from the merged,
 * strictest-wins adaptation/treatment-cap data every other candidate uses.
 */

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Byte-identical to resolve.ts's SPLIT_DAY_PREFERENCE — the winner's split
 *  schedule is unchanged from today's solo-capped split (tech design FE-3). */
const WINNER_DAY_PREFERENCE = [2, 6];
/** Disjoint from the winner's preference — Mon/Thu. */
const RIVAL_DAY_PREFERENCE = [1, 4];

export interface CycleSplitDays {
  winnerDays: number[];
  rivalDays: number[];
}

/** Deterministic pick: preferred days first (minus anything excluded), then
 *  any remaining free day in ascending order, until `size` days are chosen. */
function pickDays(preferred: number[], excluded: number[], size: number): number[] {
  const excludedSet = new Set(excluded);
  const preferredAvailable = preferred.filter((d) => !excludedSet.has(d));
  if (preferredAvailable.length >= size) return preferredAvailable.slice(0, size);
  const fallback = ALL_DAYS.filter((d) => !excludedSet.has(d) && !preferredAvailable.includes(d));
  return [...preferredAvailable, ...fallback].slice(0, size);
}

/**
 * Complementary, non-overlapping day assignments for an accepted cycle-class
 * rivalry (spec Story 3 AC1): size = min(winnerCap, rivalCap) — never
 * exceeding either product's own safety-derived frequency cap (Q1). The
 * winner keeps its existing [Tue, Sat] preference; the rival is assigned a
 * disjoint preference, falling back to any remaining free day when size != 2
 * or the preferred days collide with what the winner already took.
 */
export function computeCycleSplitDays(winnerCap: number, rivalCap: number): CycleSplitDays {
  const size = Math.max(1, Math.min(winnerCap, rivalCap, ALL_DAYS.length));
  const winnerDays = pickDays(WINNER_DAY_PREFERENCE, [], size);
  const rivalDays = pickDays(RIVAL_DAY_PREFERENCE, winnerDays, size);
  return { winnerDays, rivalDays };
}
