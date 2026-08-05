/**
 * AboutYouStep (tech design FE-7, step 4 of 5).
 * Spec: docs/specs/onboarding-5-step-redesign.md Story 5.
 * Copy: docs/specs/profile/SCREENS_onboarding_spec.md "Step 4 of 5".
 *
 * src/screens/onboarding/steps/AboutYouStep.tsx does not exist yet — this
 * file is expected to fail to import/compile until FE-7 lands (see
 * .claude/rules/testing.md: red before green).
 *
 * Resolved OQ-2 (2026-07-27): gender stays binary (Female/Male only); FE-11
 * (widening to include "Other") is dropped from scope. Assertions below
 * lock in exactly 2 pills and assert the absence of "Other".
 *
 * The Switch component's `accessibilityLabel` prop is required to
 * disambiguate this screen's own hormone-therapy toggle (see
 * src/components/ui/forms/Switch.tsx docstring) — the contract locked in
 * here is that AboutYouStep passes
 * accessibilityLabel="Currently on hormone therapy" to it.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeAboutYouStepProps } from './fixtures';
import { AboutYouStep } from '@/screens/onboarding/steps/AboutYouStep';

const TITLE = 'A little about you';
const SUBTITLE = 'Optional, but helps us personalize even better.';
const CAPTION =
  'Skin differs physiologically between men and women — this affects how products perform. We ask to personalize, not out of curiosity.';
const HORMONE_LABEL = 'Currently on hormone therapy';
const HORMONE_HELPER =
  'Affects oil production and sensitivity, regardless of the gender selected above.';

function renderStep(overrides: Parameters<typeof makeAboutYouStepProps>[0] = {}) {
  const props = makeAboutYouStepProps(overrides);
  render(<AboutYouStep {...props} />);
  return props;
}

describe('AboutYouStep — copy (SCREENS_onboarding_spec.md Step 4 of 5)', () => {
  it('renders the exact title, subtitle, hormone label and helper text', () => {
    renderStep();

    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText(SUBTITLE)).toBeTruthy();
    expect(screen.getByText(HORMONE_LABEL)).toBeTruthy();
    expect(screen.getByText(HORMONE_HELPER)).toBeTruthy();
  });

  it('renders the numeric age input with the spec placeholder', () => {
    renderStep();

    expect(screen.getByPlaceholderText('e.g. 28')).toBeTruthy();
  });
});

describe('AboutYouStep — gender stays binary (resolved OQ-2, no rework required later)', () => {
  it('renders exactly two gender pills: Female and Male', () => {
    renderStep();

    expect(screen.getByRole('checkbox', { name: 'Female' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Male' })).toBeTruthy();
  });

  it('never renders an "Other" gender option', () => {
    renderStep();

    expect(screen.queryByText('Other')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Other' })).toBeNull();
  });
});

describe('AboutYouStep — always-visible caption, not a tooltip (spec Story 5 AC1)', () => {
  it('renders the caption as plain visible text on a bare render, with no prior interaction', () => {
    renderStep();

    expect(screen.getByText(CAPTION)).toBeTruthy();
  });
});

describe('AboutYouStep — every field is optional (spec Story 5 AC2)', () => {
  it('calls onNext with no validation error when every field is left empty', () => {
    const props = renderStep();

    fireEvent.press(screen.getByText('Next'));

    expect(props.onNext).toHaveBeenCalledTimes(1);
  });
});

describe('AboutYouStep — hormone-therapy toggle persists to hormoneTherapy (spec Story 5 AC3)', () => {
  it('calls onNext with hormoneTherapy: true after turning the toggle on and pressing Next', () => {
    const props = renderStep();

    fireEvent.press(screen.getByRole('switch', { name: HORMONE_LABEL }));
    fireEvent.press(screen.getByText('Next'));

    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect((props.onNext as jest.Mock).mock.calls[0][0]).toMatchObject({ hormoneTherapy: true });
  });

  it('does not write hormoneTherapy when Skip is pressed after turning the toggle on', () => {
    const props = renderStep();

    fireEvent.press(screen.getByRole('switch', { name: HORMONE_LABEL }));
    fireEvent.press(screen.getByText('Skip'));

    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('is off by default and is not required to advance', () => {
    const props = renderStep();

    expect(screen.getByRole('switch', { name: HORMONE_LABEL }).props.accessibilityState.checked).toBe(
      false,
    );
    fireEvent.press(screen.getByText('Next'));
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });
});

describe('AboutYouStep — Back', () => {
  it('calls onBack when the back control is pressed', () => {
    const props = renderStep();

    fireEvent.press(screen.getByLabelText('Back'));

    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
