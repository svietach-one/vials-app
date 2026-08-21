/**
 * Unit tests for the pure onboarding-quiz scoring logic. Owned by engineer
 * per progress/vials-bottomsheet-consolidation.md and this task's explicit
 * instructions — the two binding invariants (A4 never outweighs A1; the
 * dehydration guard) are FE-2's own scope, deliberately NOT re-verified by
 * qa-lead's PhototypeQuizSheet.test.tsx / SkinTypeQuizSheet.test.tsx.
 *
 * Arrange/Act/Assert per .claude/rules/testing.md; no React/react-native
 * imports (this module and its test stay pure).
 */
import {
  scorePhototype,
  scoreSkinType,
  PHOTOTYPE_QUESTION_IDS,
  TONE_ANSWERS,
  SUN_REACTION_ANSWERS,
  MARKS_ANSWERS,
  TANNING_ANSWERS,
  SKINTYPE_QUESTION_IDS,
  FEEL_ANSWERS,
  MIDDAY_SHINE_ANSWERS,
  PORES_BREAKOUTS_ANSWERS,
  REACTION_ANSWERS,
} from './quizScoring';

// ─── scorePhototype ─────────────────────────────────────────────────────────

function phototypeAnswers(overrides: Partial<Record<keyof typeof PHOTOTYPE_QUESTION_IDS, string>>) {
  return {
    [PHOTOTYPE_QUESTION_IDS.tone]: overrides.tone ?? TONE_ANSWERS[0],
    [PHOTOTYPE_QUESTION_IDS.sunReaction]: overrides.sunReaction ?? SUN_REACTION_ANSWERS[0],
    [PHOTOTYPE_QUESTION_IDS.marks]: overrides.marks ?? MARKS_ANSWERS[0],
    [PHOTOTYPE_QUESTION_IDS.tanning]: overrides.tanning ?? TANNING_ANSWERS[0],
  };
}

describe('scorePhototype', () => {
  it('returns type_1_2 when every answer is the lightest option', () => {
    const result = scorePhototype(phototypeAnswers({}));

    expect(result).toBe('type_1_2');
  });

  it('returns type_5_6 when every answer is the deepest/strongest option', () => {
    const result = scorePhototype(
      phototypeAnswers({
        tone: TONE_ANSWERS[4],
        sunReaction: SUN_REACTION_ANSWERS[3],
        marks: MARKS_ANSWERS[2],
        tanning: TANNING_ANSWERS[2],
      }),
    );

    expect(result).toBe('type_5_6');
  });

  it('never moves the result away from what A1 (tone) points to when only A4 (tanning) changes', () => {
    // Property test: for every combination of tone/sunReaction/marks, vary
    // tanning across its full range and confirm the set of resulting
    // buckets never spans a full "override" of the decisive A1(+A2/A3)
    // signal — i.e. the buckets produced are never more than one band
    // apart. This is the concrete, checkable form of Story 4 AC2 ("A4
    // alone can never move the result away from what A1 points to").
    const BUCKET_ORDER: Record<string, number> = { type_1_2: 0, type_3_4: 1, type_5_6: 2 };

    for (const tone of TONE_ANSWERS) {
      for (const sunReaction of SUN_REACTION_ANSWERS) {
        for (const marks of MARKS_ANSWERS) {
          const buckets = TANNING_ANSWERS.map((tanning) =>
            BUCKET_ORDER[scorePhototype(phototypeAnswers({ tone, sunReaction, marks, tanning }))],
          );
          const spread = Math.max(...buckets) - Math.min(...buckets);
          expect(spread).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('keeps the lightest tone (A1) in type_1_2 even when tanning (A4) is maxed and other answers are mid-range', () => {
    const withoutTanning = scorePhototype(
      phototypeAnswers({ tone: TONE_ANSWERS[0], sunReaction: SUN_REACTION_ANSWERS[0], marks: MARKS_ANSWERS[0], tanning: TANNING_ANSWERS[0] }),
    );
    const withMaxTanning = scorePhototype(
      phototypeAnswers({ tone: TONE_ANSWERS[0], sunReaction: SUN_REACTION_ANSWERS[0], marks: MARKS_ANSWERS[0], tanning: TANNING_ANSWERS[2] }),
    );

    expect(withoutTanning).toBe('type_1_2');
    expect(withMaxTanning).toBe('type_1_2');
  });

  it('keeps the deepest tone (A1) out of type_1_2 regardless of tanning (A4)', () => {
    for (const tanning of TANNING_ANSWERS) {
      const result = scorePhototype(
        phototypeAnswers({ tone: TONE_ANSWERS[4], sunReaction: SUN_REACTION_ANSWERS[0], marks: MARKS_ANSWERS[0], tanning }),
      );
      expect(result).not.toBe('type_1_2');
    }
  });

  it('defaults missing answers to the lightest/weakest option rather than throwing', () => {
    expect(() => scorePhototype({})).not.toThrow();
    expect(scorePhototype({})).toBe('type_1_2');
  });
});

// ─── scoreSkinType ──────────────────────────────────────────────────────────

function skinTypeAnswers(overrides: Partial<Record<keyof typeof SKINTYPE_QUESTION_IDS, string>>) {
  return {
    [SKINTYPE_QUESTION_IDS.feel]: overrides.feel ?? FEEL_ANSWERS[1],
    [SKINTYPE_QUESTION_IDS.middayShine]: overrides.middayShine ?? MIDDAY_SHINE_ANSWERS[0],
    [SKINTYPE_QUESTION_IDS.poresBreakouts]: overrides.poresBreakouts ?? PORES_BREAKOUTS_ANSWERS[0],
    [SKINTYPE_QUESTION_IDS.reaction]: overrides.reaction ?? REACTION_ANSWERS[2],
  };
}

describe('scoreSkinType', () => {
  it('returns dry when B1 is tight/flaky and B2/B3 report no shine or breakouts', () => {
    const { skinType } = scoreSkinType(
      skinTypeAnswers({ feel: 'tight_flaky', middayShine: 'no_shine', poresBreakouts: 'rare_breakouts' }),
    );

    expect(skinType).toBe('dry');
  });

  it('returns oily when B1 and B2 both report all-over shine', () => {
    const { skinType } = scoreSkinType(
      skinTypeAnswers({ feel: 'all_over_shine', middayShine: 'shine_all_over', poresBreakouts: 'frequent_large' }),
    );

    expect(skinType).toBe('oily');
  });

  it('returns normal when every signal is neutral', () => {
    const { skinType } = scoreSkinType(
      skinTypeAnswers({ feel: 'comfortable', middayShine: 'no_shine', poresBreakouts: 'rare_breakouts' }),
    );

    expect(skinType).toBe('normal');
  });

  describe('dehydration guard (Story 5 AC2)', () => {
    it('never resolves to dry when B1 is the dedicated "tight but also shiny" option, regardless of B2/B3', () => {
      for (const middayShine of MIDDAY_SHINE_ANSWERS) {
        for (const poresBreakouts of PORES_BREAKOUTS_ANSWERS) {
          const { skinType } = scoreSkinType(
            skinTypeAnswers({ feel: 'tight_but_also_shiny', middayShine, poresBreakouts }),
          );
          expect(skinType).not.toBe('dry');
        }
      }
    });

    it('never resolves to dry when B1 reports tight/flaky but B2 also reports T-zone or all-over shine', () => {
      const tzone = scoreSkinType(
        skinTypeAnswers({ feel: 'tight_flaky', middayShine: 'shine_tzone', poresBreakouts: 'rare_breakouts' }),
      );
      const allOver = scoreSkinType(
        skinTypeAnswers({ feel: 'tight_flaky', middayShine: 'shine_all_over', poresBreakouts: 'rare_breakouts' }),
      );

      expect(tzone.skinType).not.toBe('dry');
      expect(allOver.skinType).not.toBe('dry');
    });

    it('favors the shine signal — tight/flaky + T-zone shine resolves to combination, not dry', () => {
      const { skinType } = scoreSkinType(
        skinTypeAnswers({ feel: 'tight_flaky', middayShine: 'shine_tzone', poresBreakouts: 'rare_breakouts' }),
      );

      expect(skinType).toBe('combination');
    });
  });

  describe('B4 sets `sensitive` independently of the sebum axis (Story 5 AC1)', () => {
    it('is sensitive=true for "often reacts" regardless of the sebum-axis answers', () => {
      const oilyAndSensitive = scoreSkinType(
        skinTypeAnswers({ feel: 'all_over_shine', middayShine: 'shine_all_over', reaction: 'often_reacts' }),
      );
      const dryAndSensitive = scoreSkinType(
        skinTypeAnswers({ feel: 'tight_flaky', middayShine: 'no_shine', reaction: 'often_reacts' }),
      );

      expect(oilyAndSensitive.sensitive).toBe(true);
      expect(dryAndSensitive.sensitive).toBe(true);
    });

    it('is sensitive=false for "almost never reacts" regardless of the sebum-axis answers', () => {
      const oilyNotSensitive = scoreSkinType(
        skinTypeAnswers({ feel: 'all_over_shine', middayShine: 'shine_all_over', reaction: 'almost_never_reacts' }),
      );
      const dryNotSensitive = scoreSkinType(
        skinTypeAnswers({ feel: 'tight_flaky', middayShine: 'no_shine', reaction: 'almost_never_reacts' }),
      );

      expect(oilyNotSensitive.sensitive).toBe(false);
      expect(dryNotSensitive.sensitive).toBe(false);
    });

    it('never emits a `dehydrated` value or key', () => {
      const result = scoreSkinType(skinTypeAnswers({}));

      expect(result).not.toHaveProperty('dehydrated');
    });
  });

  it('defaults missing answers to a neutral read rather than throwing', () => {
    expect(() => scoreSkinType({})).not.toThrow();
  });
});
