/**
 * GoalsStep (tech design FE-5, step 2 of 5).
 * Spec: docs/specs/onboarding-5-step-redesign.md Story 3.
 * Copy: docs/specs/profile/SCREENS_onboarding_spec.md "Step 2 of 5".
 *
 * src/screens/onboarding/steps/GoalsStep.tsx does not exist yet — this file
 * is expected to fail to import/compile until FE-5 lands (see
 * .claude/rules/testing.md: red before green).
 *
 * This is a thin integration check that GoalsStep wires the existing
 * GoalSelector in correctly — GoalSelector's own max-2 behaviour is already
 * fully covered by tests/routine-engine/goal-selector.test.tsx and is not
 * re-tested here.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeGoalsStepProps } from './fixtures';
import { GoalsStep } from '@/screens/onboarding/steps/GoalsStep';

const TITLE = 'What would you like to improve?';
const SUBTITLE = "Choose up to two goals. We'll build routines around your primary goal.";

function renderStep(overrides: Parameters<typeof makeGoalsStepProps>[0] = {}) {
  const props = makeGoalsStepProps(overrides);
  render(<GoalsStep {...props} />);
  return props;
}

describe('GoalsStep — copy (SCREENS_onboarding_spec.md Step 2 of 5)', () => {
  it('renders the exact title and subtitle', () => {
    renderStep();

    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText(SUBTITLE)).toBeTruthy();
  });
});

describe('GoalsStep — wires the existing max-2 GoalSelector correctly (spec Story 3)', () => {
  it('caps selection at two goals: a third tap is a no-op and both original goals remain chosen', () => {
    renderStep();

    fireEvent.press(screen.getByText('Clear acne'));
    fireEvent.press(screen.getByText('Fade pigmentation'));
    fireEvent.press(screen.getByText('Anti-aging'));

    expect(screen.getByRole('checkbox', { name: 'Clear acne' }).props.accessibilityState.checked).toBe(true);
    expect(
      screen.getByRole('checkbox', { name: 'Fade pigmentation' }).props.accessibilityState.checked,
    ).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Anti-aging' }).props.accessibilityState.checked).toBe(
      false,
    );
  });

  it('persists both chosen goals to primaryGoal/secondaryGoal when Next is pressed', () => {
    const props = renderStep();

    fireEvent.press(screen.getByText('Clear acne'));
    fireEvent.press(screen.getByText('Fade pigmentation'));
    fireEvent.press(screen.getByText('Next'));

    expect(props.onNext).toHaveBeenCalledTimes(1);
    const patch = (props.onNext as jest.Mock).mock.calls[0][0];
    expect(patch.primaryGoal).toBe('acne');
    expect(patch.secondaryGoal).toBe('pigmentation');
  });
});

describe('GoalsStep — Next is never gated here (tech design Assumption 7)', () => {
  it('calls onNext with the maintenance default when Next is pressed with nothing selected', () => {
    const props = renderStep();

    fireEvent.press(screen.getByText('Next'));

    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect((props.onNext as jest.Mock).mock.calls[0][0]).toMatchObject({
      primaryGoal: 'maintenance',
      secondaryGoal: null,
    });
  });
});

describe('GoalsStep — Skip and Back', () => {
  it('calls onSkip and never calls onNext when Skip is pressed, even after choosing goals', () => {
    const props = renderStep();

    fireEvent.press(screen.getByText('Clear acne'));
    fireEvent.press(screen.getByText('Skip'));

    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('calls onBack when the back control is pressed', () => {
    const props = renderStep();

    fireEvent.press(screen.getByLabelText('Back'));

    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
