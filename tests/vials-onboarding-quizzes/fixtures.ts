/**
 * Fixtures for the vials-onboarding-quizzes suite (qa-lead).
 *
 * Spec:        docs/specs/vials-onboarding-quizzes.md
 * Tech design: docs/tech-design/vials-onboarding-quizzes.md
 *
 * None of FE-1..FE-8 exist yet. `UserProfile.sensitive` (FE-1) is not yet a
 * field on the type, `migrateProfile`/`DEFAULT_PROFILE` don't backfill it
 * (FE-2/FE-3), `labels.ts` doesn't export `SENSITIVE_LABEL`/`SENSITIVE_HINT`/
 * `FITZPATRICK_DESCRIPTIONS` yet (FE-4), and `SkinTypeStep`/`PhototypeStep`/
 * `SkinProfileEditModal` don't render a "Not sure?" entry, a Sensitive
 * switch, or the post-quiz soft-copy hint yet (FE-5/6/8). Referencing all of
 * these here is expected to fail tsc/jest until the corresponding FE task
 * lands — red-before-green, same precedent as
 * tests/onboarding-5-step-redesign/fixtures.ts and
 * tests/vials-bottomsheet-consolidation/fixtures.ts.
 *
 * The three already-shipped quiz components (`QuizSheet`, `PhototypeQuizSheet`,
 * `SkinTypeQuizSheet`) and `quizScoring.ts` are NOT re-implemented or
 * re-verified here (Story 5 is a planner-audited, zero-code-change finding).
 * This suite drives them for real (no mocking of the quiz internals) to
 * exercise the actual `onComplete`/`onDismiss` hand-off into each host
 * screen — the thing this task actually builds.
 *
 * This repo has no jest-native (`toHaveTextContent`) dependency — see
 * tests/inci-attribution-highlighting/AttributionTooltip.test.tsx. Soft-copy
 * hint content is asserted via `within(...).getByText(regex)` instead (see
 * `expectHintToContainText` below), consistent with that precedent.
 *
 * ── Binding contract decisions (tech design leaves these open) ─────────────
 *
 * 1. "Not sure?" entry buttons — testID, reused identically across all 4
 *    locations (SkinTypeStep, PhototypeStep, SkinProfileEditModal x2), since
 *    the modal renders BOTH in the same tree with identical visible text
 *    ("Not sure? Help me figure it out") and needs disambiguation. `Button`
 *    already forwards arbitrary `PressableProps` (including `testID`) via its
 *    `...rest` spread — no change to the Button atom itself is implied.
 *      - NOT_SURE_SKINTYPE_TEST_ID  = 'not-sure-skintype-button'
 *      - NOT_SURE_PHOTOTYPE_TEST_ID = 'not-sure-phototype-button'
 *
 * 2. Sensitive-skin manual toggle — reuses the existing `Switch` component's
 *    `accessibilityLabel` prop exactly like `AboutYouStep`'s
 *    `accessibilityLabel={HORMONE_THERAPY_LABEL}` precedent, driven by the
 *    net-new `SENSITIVE_LABEL` export from `@/constants/labels` (FE-4) —
 *    imported here as a VALUE (not just a type) so `getByRole('switch', {
 *    name: SENSITIVE_LABEL })` works the moment FE-4/FE-5/FE-8 land, with no
 *    copy string duplicated/hardcoded in this suite (the exact wording is
 *    still open per spec §10 — this suite never asserts it).
 *
 * 3. Post-quiz soft-copy hint — new, transient, per-host local UI state (spec
 *    §5), not `PhototypeConfirmBanner`. Bound to `testID="quiz-soft-copy-hint"`
 *    on the hint's outer `Text`/`View` so presence/absence is queryable
 *    without depending on the still-provisional exact sentence. Where the
 *    hint must be shown to "name the result" (spec Story 3 AC1/AC2), this
 *    suite asserts the hint's rendered text CONTAINS the already-fixed
 *    resolved label (a `SKIN_TYPE_OPTIONS` label, or a
 *    `FITZPATRICK_DESCRIPTIONS` entry once FE-4 hoists that map into
 *    `labels.ts`) rather than pinning full prose.
 *
 * 4. Deterministic quiz walk-throughs — `scorePhototype`/`scoreSkinType`'s
 *    weights are Story 5's audited, out-of-scope-here logic, but their
 *    answer-id -> bucket mapping is public and stable (quizScoring.ts, kept
 *    verbatim per tech design Assumption 6). The label sequences below were
 *    computed directly against that file's documented weights/branches so
 *    host-wiring tests can assert an EXACT pre-selected value (e.g. "the
 *    phototype quiz that scores type_3_4 pre-selects Fitzpatrick card IV")
 *    instead of "any valid bucket" — without re-testing the scoring math
 *    itself.
 */
import { fireEvent, screen, within, act } from '@testing-library/react-native';

import type { FitzpatrickType, SkinPhototype, SkinType, UserProfile } from '@/types';

// ─── testID contract ────────────────────────────────────────────────────────

export const NOT_SURE_SKINTYPE_TEST_ID = 'not-sure-skintype-button';
export const NOT_SURE_PHOTOTYPE_TEST_ID = 'not-sure-phototype-button';
export const SOFT_COPY_HINT_TEST_ID = 'quiz-soft-copy-hint';

// ─── UserProfile factory (FE-1: adds `sensitive: boolean`) ─────────────────

export function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'local-user',
    gender: null,
    age: null,
    skinType: null,
    phototype: null,
    fitzpatrick: null,
    city: null,
    concerns: [],
    skinConditions: [],
    primaryGoal: 'maintenance',
    secondaryGoal: null,
    goalNeedsConfirmation: false,
    phototypeNeedsConfirmation: false,
    spfSensitivity: false,
    onboardingCompleted: false,
    individualDurationMonths: {},
    contributionConsent: { granted: false, timestamp: null },
    hormoneTherapy: false,
    pregnantOrBreastfeeding: false,
    // FE-1: net-new required field, backfilled to `false` by `migrateProfile`
    // (schema v6->v7). EXPECTED to fail tsc ("Object literal may only
    // specify known properties") until FE-1 lands, same idiom as
    // hormoneTherapy/pregnantOrBreastfeeding did for onboarding-5-step-redesign.
    sensitive: false,
    ...overrides,
  };
}

// ─── Deterministic phototype-quiz answer sequences ─────────────────────────
// Question order: tone (A1) -> sunReaction (A2) -> marks (A3) -> tanning (A4).
// Computed against quizScoring.ts's documented coreTotal bands so the result
// is exact and independent of the A4 tie-break zones.

export const PHOTOTYPE_QUIZ_ANSWERS: Record<SkinPhototype, readonly string[]> = {
  // tone=0*6 + sunReaction=0*5 + marks=0*3 = 0 <= 14 -> type_1_2 (unconditional).
  type_1_2: [
    'Very light, almost translucent',
    'Always burns, never tans',
    'Rarely leaves a mark',
    "Doesn't tan at all",
  ],
  // tone=2*6 + sunReaction=2*5 + marks=1*3 = 25, 18-27 -> type_3_4 (unconditional).
  type_3_4: [
    'Medium, golden beige',
    'Sometimes a mild burn, then tans',
    'Sometimes, fades within a few weeks',
    "Doesn't tan at all",
  ],
  // tone=4*6 + sunReaction=3*5 + marks=2*3 = 45 >= 31 -> type_5_6 (unconditional).
  type_5_6: [
    'Deep, rich brown',
    'Rarely burns, tans easily',
    'Often, and it can take months to fade',
    "Doesn't tan at all",
  ],
};

/** The safety-first FitzpatrickCard `deriveFitzpatrick` maps each bucket to. */
export const EXPECTED_FITZPATRICK_FOR_BUCKET: Record<SkinPhototype, FitzpatrickType> = {
  type_1_2: 1,
  type_3_4: 4,
  type_5_6: 6,
};

// ─── Deterministic skin-type-quiz answer sequences ─────────────────────────
// Question order: feel (B1) -> middayShine (B2) -> poresBreakouts (B3) -> reaction (B4).

export const SKINTYPE_QUIZ_ANSWERS: Record<string, readonly string[]> = {
  // feel=tight_flaky, shineScore=0 -> dry; reaction=almost_never_reacts -> sensitive:false.
  dry_not_sensitive: [
    'Tight, rough, or flaky',
    'Nowhere',
    'Pores barely visible, breakouts are rare',
    'Almost never reacts',
  ],
  // feel=all_over_shine -> oily regardless of B2/B3; reaction=often_reacts -> sensitive:true.
  oily_sensitive: [
    'Shiny all over',
    'Nowhere',
    'Pores barely visible, breakouts are rare',
    'Often stings or turns red',
  ],
  // feel=tzone_shine -> combination regardless of B2/B3; reaction=sometimes_reacts -> sensitive:true.
  combination_sensitive: [
    'Slightly shiny, but only in the T-zone',
    'Nowhere',
    'Pores barely visible, breakouts are rare',
    'Sometimes reacts',
  ],
  // feel=comfortable, shineScore=0, not dry-eligible -> normal; reaction=almost_never_reacts -> sensitive:false.
  normal_not_sensitive: [
    'Comfortable, nothing in particular',
    'Nowhere',
    'Pores barely visible, breakouts are rare',
    'Almost never reacts',
  ],
};

export const EXPECTED_SKINTYPE_RESULT: Record<string, { skinType: SkinType; sensitive: boolean }> = {
  dry_not_sensitive: { skinType: 'dry', sensitive: false },
  oily_sensitive: { skinType: 'oily', sensitive: true },
  combination_sensitive: { skinType: 'combination', sensitive: true },
  normal_not_sensitive: { skinType: 'normal', sensitive: false },
};

// ─── Quiz-walking helper ────────────────────────────────────────────────────

/**
 * Walks a rendered `QuizSheet`-family sheet to completion by pressing each
 * answer label in order (real chip taps -> real ~260ms auto-advance -> real
 * "Show result" on the final question). Requires fake timers to be active
 * (`jest.useFakeTimers()`) in the calling test file, same convention as
 * tests/vials-bottomsheet-consolidation/QuizSheet.test.tsx.
 */
export function answerQuizByLabels(labels: readonly string[]) {
  labels.forEach((label, i) => {
    fireEvent.press(screen.getByRole('radio', { name: label }));
    if (i === labels.length - 1) {
      fireEvent.press(screen.getByRole('button', { name: 'Show result' }));
    } else {
      act(() => {
        jest.advanceTimersByTime(300);
      });
    }
  });
}

// ─── Soft-copy hint content helper (no jest-native in this repo) ──────────

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Asserts the soft-copy hint (`testID=SOFT_COPY_HINT_TEST_ID`) is present and
 * its rendered text contains `expectedSubstring` — without depending on the
 * hint's exact (still-provisional) surrounding prose. Uses `within(...)
 * .getByText(regex)` rather than `toHaveTextContent` (jest-native), which
 * this repo does not depend on — see tests/inci-attribution-highlighting/
 * AttributionTooltip.test.tsx.
 */
export function expectHintToContainText(expectedSubstring: string) {
  const hint = screen.getByTestId(SOFT_COPY_HINT_TEST_ID);
  expect(within(hint).getByText(new RegExp(escapeRegExp(expectedSubstring)))).toBeTruthy();
}
