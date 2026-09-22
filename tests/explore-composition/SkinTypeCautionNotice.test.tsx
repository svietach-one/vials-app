/**
 * Component test — SkinTypeCautionNotice (explore-insights-v2 task 05,
 * extended by explore-fit-signals FE-4 for condition-aware enrichment).
 * Spec: docs/specs/explore-fit-signals.md §4 Story 2, Story 3 AC3 (regression)
 * Tech design: docs/tech-design/explore-fit-signals.md §3 FE-4
 *
 * `conditionCaution: ConditionCautionFinding[]` is a NEW required prop
 * (FE-4) — `SkinTypeCautionNotice.tsx` does not accept it yet, so every test
 * below is EXPECTED to fail to compile/run until FE-3/FE-4 land, same
 * qa-lead-before-engineer convention as every other file in this task.
 *
 * The original four caution x skinType branches (explore-insights-v2 task
 * 05) are kept below, now passing `conditionCaution: []` explicitly, as
 * REGRESSION coverage proving two things did NOT change for the
 * no-conditions path (spec Story 2 AC4, Story 3 AC3):
 *   1. the top-level render guard's old branch (`caution === null` ->
 *      render nothing) still holds when `conditionCaution` is empty;
 *   2. the skin-type-unset nudge's own gate stays EXACTLY
 *      `caution !== null && skinType === null` — not widened to fire
 *      whenever `skinType === null` alone (spec §10 Open Question 3,
 *      RESOLVED 2026-09-14: KEEP the current scope).
 *
 * The new describe blocks below exercise FE-4's actual behavior change: the
 * top-level guard becomes `caution === null && conditionCaution.length ===
 * 0`, condition lines render independently of `skinType`, same-active
 * precedence (condition-specific wins, generic sentence excludes that key),
 * and the KEY REGRESSION CASE proving the render gate changed rather than
 * just gaining an inert prop — azelaic acid under eczema, which trips a
 * condition advisory but never the generic skin-type trigger.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { SkinTypeCautionNotice } from '@/components/catalog/SkinTypeCautionNotice';
import type { ConditionCautionFinding } from '@/utils/productProfile/conditionCaution';
import type { SkinTypeCautionResult } from '@/utils/productProfile/skinTypeCaution';
import { makeConditionCautionFinding } from './fixtures';

const CAUTION: SkinTypeCautionResult = { triggeringKeys: ['aha'] };

// Real case from the tech design: azelaic acid never trips the generic
// skin-type trigger (actives.json: irritancy 2, exfoliating: false,
// photosensitizing: false — below the flat-tier threshold) but IS an eczema
// advisory tag in CONDITION_MODIFIERS. This is the case proving the render
// gate itself changed, not just gained a prop.
const AZELAIC_ECZEMA_FINDING: ConditionCautionFinding = makeConditionCautionFinding({
  tag: 'azelaic_acid',
  conditions: ['eczema'],
  conditionLabels: ['Eczema / atopic dermatitis'],
  severity: 'low',
  message:
    'Azelaic acid is usually well tolerated on eczema-prone skin. Some people notice mild tingling at first — introducing it gradually helps.',
});

const RETINOID_ECZEMA_FINDING: ConditionCautionFinding = makeConditionCautionFinding({
  tag: 'retinoid',
  conditions: ['eczema'],
  conditionLabels: ['Eczema / atopic dermatitis'],
  severity: 'medium',
  message:
    'Retinoids carry a higher irritation risk on eczema-prone skin. Consider introducing this gradually and monitor how your skin responds.',
});

function renderNotice(props: {
  caution: SkinTypeCautionResult | null;
  skinType: 'oily' | 'dry' | 'combination' | 'normal' | null;
  conditionCaution?: ConditionCautionFinding[];
  onSetSkinType?: () => void;
}) {
  const onSetSkinType = props.onSetSkinType ?? jest.fn();
  render(
    <SkinTypeCautionNotice
      caution={props.caution}
      skinType={props.skinType}
      conditionCaution={props.conditionCaution ?? []}
      onSetSkinType={onSetSkinType}
    />,
  );
  return { onSetSkinType };
}

describe('SkinTypeCautionNotice — four caution x skinType branches (regression, conditionCaution: [])', () => {
  it('caution present + skin type null -> renders the nudge, with a working navigation action', () => {
    const { onSetSkinType } = renderNotice({ caution: CAUTION, skinType: null });

    expect(screen.getByTestId('skin-type-nudge')).toBeTruthy();
    expect(
      screen.getByText('Set your skin type to see how these ingredients suit you'),
    ).toBeTruthy();
    const link = screen.getByText('Set skin type');
    expect(onSetSkinType).not.toHaveBeenCalled();
    fireEvent.press(link);
    expect(onSetSkinType).toHaveBeenCalledTimes(1);

    expect(screen.queryByTestId('skin-type-caution')).toBeNull();
    expect(screen.queryByTestId('condition-caution')).toBeNull();
  });

  it('caution present + skin type set -> renders the existing caution sentence, unchanged', () => {
    renderNotice({ caution: CAUTION, skinType: 'oily' });

    const caution = screen.getByTestId('skin-type-caution');
    expect(caution).toBeTruthy();
    expect(screen.getByText(/aha acids/i)).toBeTruthy();
    expect(screen.getByText(/oily/i)).toBeTruthy();

    expect(screen.queryByTestId('skin-type-nudge')).toBeNull();
    expect(screen.queryByTestId('condition-caution')).toBeNull();
  });

  it('no caution + skin type set -> renders nothing', () => {
    const { toJSON } = render(
      <SkinTypeCautionNotice caution={null} skinType="dry" conditionCaution={[]} onSetSkinType={jest.fn()} />,
    );

    expect(toJSON()).toBeNull();
  });

  it('no caution + no skin type -> renders nothing (no promised insight with nothing to say)', () => {
    const { toJSON } = render(
      <SkinTypeCautionNotice caution={null} skinType={null} conditionCaution={[]} onSetSkinType={jest.fn()} />,
    );

    expect(toJSON()).toBeNull();
  });
});

// ── Condition-aware enrichment (explore-fit-signals FE-3/FE-4) ────────────────

describe('Condition-only trigger: the render gate changed, not just gained a prop (azelaic acid under eczema)', () => {
  it('renders the condition-specific line even when caution === null (generic skin-type trigger never fires for azelaic acid)', () => {
    renderNotice({ caution: null, skinType: 'oily', conditionCaution: [AZELAIC_ECZEMA_FINDING] });

    const condition = screen.getByTestId('condition-caution');
    expect(within(condition).getByText(AZELAIC_ECZEMA_FINDING.message)).toBeTruthy();
    expect(screen.queryByTestId('skin-type-caution')).toBeNull();
  });

  it('KEY REGRESSION: does NOT fire the skin-type-unset nudge just because a condition line is present with skinType null — nudge gate stays caution !== null && skinType === null, not widened (spec §10 Open Question 3)', () => {
    renderNotice({ caution: null, skinType: null, conditionCaution: [AZELAIC_ECZEMA_FINDING] });

    expect(screen.getByTestId('condition-caution')).toBeTruthy();
    expect(screen.queryByTestId('skin-type-nudge')).toBeNull();
  });

  it('renders the condition line regardless of skinType being set', () => {
    renderNotice({ caution: null, skinType: 'dry', conditionCaution: [AZELAIC_ECZEMA_FINDING] });

    expect(screen.getByTestId('condition-caution')).toBeTruthy();
    expect(screen.queryByTestId('skin-type-nudge')).toBeNull();
    expect(screen.queryByTestId('skin-type-caution')).toBeNull();
  });

  it('the top-level guard now checks conditionCaution too — no longer null/nothing purely because caution is null', () => {
    const { toJSON } = render(
      <SkinTypeCautionNotice
        caution={null}
        skinType={null}
        conditionCaution={[AZELAIC_ECZEMA_FINDING]}
        onSetSkinType={jest.fn()}
      />,
    );

    expect(toJSON()).not.toBeNull();
  });
});

describe('Same-active precedence: condition-specific line wins for that active, generic sentence excludes it', () => {
  it('shows the condition-specific sentence for the shared active and suppresses the generic sentence entirely when nothing remains', () => {
    renderNotice({
      caution: { triggeringKeys: ['retinoid'] },
      skinType: 'oily',
      conditionCaution: [RETINOID_ECZEMA_FINDING],
    });

    const condition = screen.getByTestId('condition-caution');
    expect(within(condition).getByText(RETINOID_ECZEMA_FINDING.message)).toBeTruthy();
    // The only triggering key (retinoid) is fully covered by the condition
    // finding -> the generic sentence's remainder is empty -> suppressed.
    expect(screen.queryByTestId('skin-type-caution')).toBeNull();
  });

  it('still names a second, non-covered triggering active in the generic sentence — no fact from either signal is silently dropped', () => {
    renderNotice({
      caution: { triggeringKeys: ['retinoid', 'aha'] },
      skinType: 'oily',
      conditionCaution: [RETINOID_ECZEMA_FINDING],
    });

    const condition = screen.getByTestId('condition-caution');
    expect(within(condition).getByText(/retinoid/i)).toBeTruthy();

    const generic = screen.getByTestId('skin-type-caution');
    expect(within(generic).getByText(/aha/i)).toBeTruthy();
    expect(within(generic).queryByText(/retinoid/i)).toBeNull();
  });

  it('does not repeat the condition-covered active inside the condition block\'s own sibling generic block, even when skin type is unset (nudge branch)', () => {
    renderNotice({
      caution: { triggeringKeys: ['retinoid'] },
      skinType: null,
      conditionCaution: [RETINOID_ECZEMA_FINDING],
    });

    // caution !== null && skinType === null -> nudge still fires (gate
    // unchanged), condition line also renders (independent of skinType).
    expect(screen.getByTestId('condition-caution')).toBeTruthy();
    expect(screen.getByTestId('skin-type-nudge')).toBeTruthy();
    expect(screen.queryByTestId('skin-type-caution')).toBeNull();
  });
});

describe('No skinConditions set: behavior is unchanged from today (generic caution only, or nothing)', () => {
  it('renders only the generic caution when conditionCaution is empty and the generic trigger fires', () => {
    renderNotice({ caution: CAUTION, skinType: 'oily', conditionCaution: [] });

    expect(screen.getByTestId('skin-type-caution')).toBeTruthy();
    expect(screen.queryByTestId('condition-caution')).toBeNull();
  });

  it('renders nothing when conditionCaution is empty and the generic trigger never fired either', () => {
    const { toJSON } = render(
      <SkinTypeCautionNotice caution={null} skinType="oily" conditionCaution={[]} onSetSkinType={jest.fn()} />,
    );

    expect(toJSON()).toBeNull();
  });

  it('renders only the nudge, unchanged, when conditionCaution is empty and the generic trigger fires with no skin type set', () => {
    renderNotice({ caution: CAUTION, skinType: null, conditionCaution: [] });

    expect(screen.getByTestId('skin-type-nudge')).toBeTruthy();
    expect(screen.queryByTestId('condition-caution')).toBeNull();
  });
});
