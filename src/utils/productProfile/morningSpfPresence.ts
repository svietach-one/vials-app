/**
 * Product Profile builder — morning SPF presence.
 * docs/tasks/explore_insights/06-routine-gap-spf.md
 *
 * Answers a different question than `spfAdequacy.ts`'s `getSpfAdequacyFinding`:
 * that module asks "is the scheduled sunscreen STRONG ENOUGH" (SPF-30
 * threshold, gated to Light/Fair phototypes in summer, gated to today via
 * `isScheduledOnDay`); this module asks "is there ANY sunscreen at all."
 * Absence and strength are two different rules — `spfAdequacy.ts`'s own
 * docstring (`spfAdequacy.ts:74-76`) says explicitly that "no SPF scheduled
 * at all" is deliberately not its concern, and US-29's own Acceptance
 * Criteria (`docs/specs/<subfolder>/USER_STORIES.md`) lists "a separate 'no SPF
 * scheduled at all' finding" under Out of Scope — tracked, never written.
 * This module is that untracked absence half; there is no separate US
 * number for it to cite. Do not import `spfAdequacy.ts` from here, and do
 * not re-implement its SPF-30 threshold — this module never reads
 * `spfValue` at all.
 *
 * Two deliberate differences from `spfAdequacy.ts`'s traversal, beyond the
 * question being asked:
 *   1. No phototype or season gate. Absence of sun protection is worth
 *      mentioning year-round and at every phototype — a threshold claim
 *      needs the Light/Fair-in-summer context to be defensible; a bare
 *      presence observation does not.
 *   2. No day-of-week scoping. `spfAdequacy.ts:89,96` scopes to today via
 *      `isScheduledOnDay`. This check looks across ALL scheduled days: a
 *      user standing in a shop scanning a product is not asking about
 *      today, and "you have SPF, just not on Tuesdays" would be a
 *      confusing thing to say on the Explore result screen.
 *
 * The step-walking/skip-rule convention (hidden step, null productId, no
 * matching product, hidden product) mirrors `spfAdequacy.ts:94-99` — that
 * traversal shape is the thing worth reusing, not its threshold logic.
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */
import type { Product, Routine } from '@/types';

export type MorningSpfState = 'present' | 'absent' | 'no-morning-routine';

/**
 * `'no-morning-routine'` — no routine with `timeOfDay === 'morning'`, or
 * every morning routine has zero visible steps that resolve to a real,
 * non-hidden product. Distinct from `'absent'` on purpose: a user who has
 * not built a morning routine at all must not be told their morning routine
 * is missing SPF — that would be nagging someone for not having started.
 *
 * `'present'` — at least one such step resolves to a product with
 * `productType === 'spf'`, regardless of whether its `spfValue` is known.
 *
 * `'absent'` — a morning routine with real, visible products exists, and
 * none of them is `productType === 'spf'`.
 */
export function getMorningSpfState(routines: Routine[], products: Product[]): MorningSpfState {
  const morningRoutines = routines.filter((r) => r.timeOfDay === 'morning');

  let hasVisibleProductStep = false;
  let hasSpfProduct = false;

  for (const routine of morningRoutines) {
    for (const step of routine.steps) {
      if (step.hidden || !step.productId) continue;
      const product = products.find((p) => p.id === step.productId);
      if (!product || product.isHidden) continue;

      hasVisibleProductStep = true;
      if (product.productType === 'spf') hasSpfProduct = true;
    }
  }

  if (!hasVisibleProductStep) return 'no-morning-routine';
  return hasSpfProduct ? 'present' : 'absent';
}
