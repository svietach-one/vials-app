/**
 * SkinTypeStep (tech design FE-4, step 1 of 5).
 * Spec: docs/specs/onboarding-5-step-redesign.md Stories 1-2.
 * Copy: docs/specs/profile/SCREENS_onboarding_spec.md "Step 1 of 5".
 *
 * src/screens/onboarding/steps/SkinTypeStep.tsx does not exist yet — this
 * file is expected to fail to import/compile until FE-4 lands (see
 * .claude/rules/testing.md: red before green).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeSkinTypeStepProps } from './fixtures';
import { SkinTypeStep } from '@/screens/onboarding/steps/SkinTypeStep';

const TITLE = "What's your skin type?";
const SUBTITLE = 'Choose the option that best describes your skin most of the time.';

function renderStep(overrides: Parameters<typeof makeSkinTypeStepProps>[0] = {}) {
  const props = makeSkinTypeStepProps(overrides);
  render(<SkinTypeStep {...props} />);
  return props;
}

describe('SkinTypeStep — copy (SCREENS_onboarding_spec.md Step 1 of 5)', () => {
  it('renders the exact title and subtitle', () => {
    renderStep();

    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText(SUBTITLE)).toBeTruthy();
  });

  it('renders all four skin type options', () => {
    renderStep();

    ['Oily', 'Dry', 'Combination', 'Normal'].forEach((label) => {
      expect(screen.getByText(label)).toBeTruthy();
    });
  });

  it('has no Back control on the first step', () => {
    renderStep();

    expect(screen.queryByLabelText('Back')).toBeNull();
  });
});

describe('SkinTypeStep — seeds the selected chip from initialSkinType on mount (tech design Assumption 8)', () => {
  it('shows the option matching initialSkinType as already selected', () => {
    renderStep({ initialSkinType: 'dry' });

    expect(screen.getByRole('checkbox', { name: 'Dry' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Oily' }).props.accessibilityState.checked).toBe(false);
  });
});

describe('SkinTypeStep — Next disabled until a value is chosen (tech design Assumption 7)', () => {
  it('does not call onNext when Next is pressed before any option is chosen', () => {
    const props = renderStep();

    fireEvent.press(screen.getByText('Next'));

    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('calls onNext with the chosen skin type after selecting an option', () => {
    const props = renderStep();

    fireEvent.press(screen.getByText('Dry'));
    fireEvent.press(screen.getByText('Next'));

    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect((props.onNext as jest.Mock).mock.calls[0][0]).toMatchObject({ skinType: 'dry' });
  });
});

describe('SkinTypeStep — Skip advances without persisting (spec Story 2)', () => {
  it('calls onSkip and never calls onNext when Skip is pressed, even after choosing an option', () => {
    const props = renderStep();

    fireEvent.press(screen.getByText('Oily'));
    fireEvent.press(screen.getByText('Skip'));

    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onNext).not.toHaveBeenCalled();
  });
});
