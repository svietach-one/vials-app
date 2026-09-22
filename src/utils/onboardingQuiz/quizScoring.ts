/**
 * Pure scoring logic for the onboarding "not sure?" quizzes (Quiz A —
 * phototype, Quiz B — skin type). No React/react-native imports, per
 * .claude/rules/testing.md's "no React imports in business-logic utils"
 * rule — `QuizSheet`/`PhototypeQuizSheet`/`SkinTypeQuizSheet` call these as
 * plain functions, passing the answersByQuestionId record QuizSheet already
 * tracks as component state.
 *
 * Content & point values are provisional (spec §3 Non-Goals, tech design
 * Assumption 7) — exact weights are NOT final. Two invariants ARE binding
 * (spec Story 4 AC2 / Story 5 AC2) and are covered by this file's own
 * quizScoring.test.ts, not qa-lead's integration suite:
 *   - A4 (tanning) can never outweigh A1 (tone) in phototype scoring.
 *   - A "tight but also shiny" skin-type read never resolves to `dry` — the
 *     dehydration guard favors the shine signal.
 *
 * Question/answer copy follows docs/tasks/vials-onboarding-quizzes-task.md
 * §Quiz A / §Quiz B. Answer id strings below are the source of truth for
 * both the scoring functions and the two QuizSheet-family components that
 * build their QuizQuestionDef arrays around them.
 */

import type { SkinPhototype, SkinType } from '@/types';

// ─── Quiz A — Phototype ─────────────────────────────────────────────────────

export const PHOTOTYPE_QUESTION_IDS = {
  tone: 'a1_tone',
  sunReaction: 'a2_sun_reaction',
  marks: 'a3_marks',
  tanning: 'a4_tanning',
} as const;

/** A1 — natural tone of skin rarely exposed to sun. No racial/ethnicity labels. */
export const TONE_ANSWERS = ['very_light', 'light', 'medium', 'tan_olive', 'deep'] as const;

/** A2 — reaction to sun with no protection. */
export const SUN_REACTION_ANSWERS = [
  'always_burns',
  'usually_burns_slight_tan',
  'sometimes_burns_then_tans',
  'rarely_burns_tans_easily',
] as const;

/** A3 — tendency toward dark marks / hyperpigmentation after spots, cuts, or irritation. */
export const MARKS_ANSWERS = ['rarely_marks', 'sometimes_marks', 'often_marks'] as const;

/** A4 — tanning tendency. Tie-breaker only — must never outweigh A1 (tone). */
export const TANNING_ANSWERS = ['doesnt_tan', 'tans_lightly', 'tans_easily_deeply'] as const;

type AnswersById = Record<string, string>;

function indexOf<T extends readonly string[]>(options: T, value: string | undefined): number {
  if (!value) return 0;
  const i = options.indexOf(value as T[number]);
  return i === -1 ? 0 : i;
}

// Weights: A1/A2 = High (strongest discriminators, for deep and light skin
// respectively), A3 = Medium, A4 = Low (tie-breaker only).
const TONE_WEIGHT = 6;
const SUN_REACTION_WEIGHT = 5;
const MARKS_WEIGHT = 3;

// coreTotal range: tone (0-4)*6 + sunReaction (0-3)*5 + marks (0-2)*3 = 0..45.
// Outside the two narrow tie-break bands, A4 (tanning) has ZERO effect on
// the result — the bucket is decided entirely by A1/A2/A3. Inside a
// tie-break band, tanning can only nudge to the ADJACENT bucket, never
// skip past it — so a decisive A1 (+A2/A3) signal can never be overridden
// by A4 alone. See quizScoring.test.ts for the property test this guarantees.
const LOW_ZONE_MAX = 14; // coreTotal <= 14 -> type_1_2, unconditionally
const LOW_TIEBREAK_MAX = 17; // 15-17 -> type_1_2 unless tanning is maxed
const MID_ZONE_MAX = 27; // 18-27 -> type_3_4, unconditionally
const HIGH_TIEBREAK_MAX = 30; // 28-30 -> type_3_4 unless tanning is maxed
// coreTotal >= 31 -> type_5_6, unconditionally

/**
 * Scores the 4-question phototype quiz into one of the app's 3 existing
 * phototype buckets. `answers` is keyed by question id
 * (`PHOTOTYPE_QUESTION_IDS`) -> chosen answer id.
 */
export function scorePhototype(answers: AnswersById): SkinPhototype {
  const tone = indexOf(TONE_ANSWERS, answers[PHOTOTYPE_QUESTION_IDS.tone]);
  const sunReaction = indexOf(SUN_REACTION_ANSWERS, answers[PHOTOTYPE_QUESTION_IDS.sunReaction]);
  const marks = indexOf(MARKS_ANSWERS, answers[PHOTOTYPE_QUESTION_IDS.marks]);
  const tanning = indexOf(TANNING_ANSWERS, answers[PHOTOTYPE_QUESTION_IDS.tanning]);

  const coreTotal = tone * TONE_WEIGHT + sunReaction * SUN_REACTION_WEIGHT + marks * MARKS_WEIGHT;

  if (coreTotal <= LOW_ZONE_MAX) return 'type_1_2';
  if (coreTotal <= LOW_TIEBREAK_MAX) return tanning >= 2 ? 'type_3_4' : 'type_1_2';
  if (coreTotal <= MID_ZONE_MAX) return 'type_3_4';
  if (coreTotal <= HIGH_TIEBREAK_MAX) return tanning >= 2 ? 'type_5_6' : 'type_3_4';
  return 'type_5_6';
}

// ─── Quiz B — Skin Type ─────────────────────────────────────────────────────

export const SKINTYPE_QUESTION_IDS = {
  feel: 'b1_feel',
  middayShine: 'b2_midday_shine',
  poresBreakouts: 'b3_pores_breakouts',
  reaction: 'b4_reaction',
} as const;

/**
 * B1 — how skin usually feels a few hours after washing with nothing
 * applied. `tight_but_also_shiny` is the dedicated dehydration-guard
 * option: tightness right after washing that passes, paired with shine
 * noticed later — deliberately distinct from `tight_flaky`, the only
 * answer that can resolve to `dry`.
 */
export const FEEL_ANSWERS = [
  'tight_flaky',
  'comfortable',
  'tzone_shine',
  'all_over_shine',
  'tight_but_also_shiny',
] as const;

/** B2 — midday shine and where. Confirms/corroborates B1. */
export const MIDDAY_SHINE_ANSWERS = ['no_shine', 'shine_tzone', 'shine_all_over'] as const;

/** B3 — pores and breakouts. Secondary oiliness marker. */
export const PORES_BREAKOUTS_ANSWERS = ['rare_breakouts', 'occasional_tzone', 'frequent_large'] as const;

/** B4 — reaction to new products. Sets `sensitive` alone, independent of the sebum axis. */
export const REACTION_ANSWERS = ['often_reacts', 'sometimes_reacts', 'almost_never_reacts'] as const;

const MIDDAY_SHINE_POINTS: Record<(typeof MIDDAY_SHINE_ANSWERS)[number], number> = {
  no_shine: 0,
  shine_tzone: 2,
  shine_all_over: 3,
};

const PORES_BREAKOUTS_POINTS: Record<(typeof PORES_BREAKOUTS_ANSWERS)[number], number> = {
  rare_breakouts: 0,
  occasional_tzone: 2,
  frequent_large: 3,
};

function deriveSkinType(
  feel: (typeof FEEL_ANSWERS)[number],
  midday: (typeof MIDDAY_SHINE_ANSWERS)[number],
  pores: (typeof PORES_BREAKOUTS_ANSWERS)[number],
): SkinType {
  const shineScore = MIDDAY_SHINE_POINTS[midday] + PORES_BREAKOUTS_POINTS[pores]; // 0-6
  const feelIsOily = feel === 'all_over_shine';
  const feelIsCombo = feel === 'tzone_shine' || feel === 'tight_but_also_shiny';
  // The ONLY answer that can lead to `dry` — every other B1 answer,
  // including the dehydration-guard option, is excluded from this path.
  const dryEligible = feel === 'tight_flaky';

  if (feelIsOily || shineScore >= 5) return 'oily';
  if (feelIsCombo || midday === 'shine_tzone') return 'combination';
  if (dryEligible && shineScore === 0) return 'dry';
  // Dehydration guard: a "tight" B1 read that is corroborated by ANY shine
  // signal from B2/B3 never resolves to `dry` — the shine signal wins.
  if (dryEligible) return 'combination';
  return 'normal';
}

/**
 * Scores the 4-question skin-type quiz into `{ skinType, sensitive }`.
 * `answers` is keyed by question id (`SKINTYPE_QUESTION_IDS`) -> chosen
 * answer id. Never emits a `dehydrated` value — dehydration is a transient
 * condition, out of scope for this one-time profile attribute (see
 * docs/tasks/vials-onboarding-quizzes-task.md's Type changes section).
 */
export function scoreSkinType(answers: AnswersById): { skinType: SkinType; sensitive: boolean } {
  const feelIndex = indexOf(FEEL_ANSWERS, answers[SKINTYPE_QUESTION_IDS.feel]);
  const middayIndex = indexOf(MIDDAY_SHINE_ANSWERS, answers[SKINTYPE_QUESTION_IDS.middayShine]);
  const poresIndex = indexOf(PORES_BREAKOUTS_ANSWERS, answers[SKINTYPE_QUESTION_IDS.poresBreakouts]);

  const feel = FEEL_ANSWERS[feelIndex];
  const midday = MIDDAY_SHINE_ANSWERS[middayIndex];
  const pores = PORES_BREAKOUTS_ANSWERS[poresIndex];

  // B4 alone determines `sensitive`, independent of the sebum axis above.
  const reaction = answers[SKINTYPE_QUESTION_IDS.reaction];
  const sensitive = reaction === 'often_reacts' || reaction === 'sometimes_reacts';

  return { skinType: deriveSkinType(feel, midday, pores), sensitive };
}
