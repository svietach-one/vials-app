import type { ActiveIngredientKey, StepTransition } from '@/types';

/** The `text` union of the `{ kind: 'note' }` branch only — `StepTransition`
 *  itself also has a `{ kind: 'none' }` branch with no `text` field. */
export type StepTransitionNoteText = Extract<StepTransition, { kind: 'note' }>['text'];

/**
 * Layering-note rules between adjacent rendered steps (routine-step-grouping
 * PRD_Spec.md §5.3). Exactly four entries — every other active class
 * produces `{ kind: 'none' }`. No numeric `wait` variant: durations were
 * specified and removed on evidence (see PRD_Spec.md §5.2); do not
 * reintroduce them without a dermatologist sign-off (§5.5).
 *
 * Every key here is asserted against `actives.json`'s `classes` block in
 * stepTransitions.test.ts, so a typo (e.g. `azelaic` for `azelaic_acid`, or a
 * prose name in place of `hyaluronic_acid`) fails a test instead of silently
 * compiling into a rule that never fires.
 */
export const TRANSITION_RULES: Partial<
  Record<ActiveIngredientKey, { after?: StepTransition; before?: StepTransition }>
> = {
  retinoid: {
    before: { kind: 'note', text: 'dry_skin' },
  },
  benzoyl_peroxide: {
    after: { kind: 'note', text: 'until_dry' },
  },
  hyaluronic_acid: {
    after: { kind: 'note', text: 'immediate' },
  },
  spf_filters: {
    after: { kind: 'note', text: 'before_sun' },
  },
};

/**
 * Precedence when several notes apply to one gap (PRD_Spec.md §5.4):
 * `dry_skin` > `until_dry` > `immediate`. `before_sun` is listed last since
 * it only ever fires alone, on the gap after the final AM step.
 */
export const TRANSITION_PRECEDENCE: StepTransitionNoteText[] = [
  'dry_skin',
  'until_dry',
  'immediate',
  'before_sun',
];
