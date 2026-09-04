/**
 * SkinTypeStep (onboarding step 1) — Stories 2, 3, 4.
 * Spec: docs/specs/vials-onboarding-quizzes.md
 * Tech design: docs/tech-design/vials-onboarding-quizzes.md FE-5.
 *
 * `SkinTypeStep` already exists (onboarding-5-step-redesign) but has no
 * `initialSensitive` prop, no "Not sure?" entry, no Sensitive switch, and no
 * quiz wiring yet — every test below is expected to fail (tsc excess-prop on
 * `initialSensitive`, or "unable to find element" at runtime) until FE-5
 * lands. Renders the REAL `SkinTypeQuizSheet`/`QuizSheet`/`BottomSheet`
 * underneath (nothing quiz-related is mocked) so the `onComplete`/`onDismiss`
 * hand-off is exercised for real, not simulated.
 */
import React from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

import { SkinTypeStep, type SkinTypeStepProps } from '@/screens/onboarding/steps/SkinTypeStep';
import { SENSITIVE_LABEL } from '@/constants/labels';
import {
  NOT_SURE_SKINTYPE_TEST_ID,
  SOFT_COPY_HINT_TEST_ID,
  SKINTYPE_QUIZ_ANSWERS,
  EXPECTED_SKINTYPE_RESULT,
  answerQuizByLabels,
} from './fixtures';

function renderStep(
  overrides: Partial<SkinTypeStepProps & { initialSensitive: boolean }> = {},
) {
  const props = {
    initialSkinType: null,
    initialSensitive: false,
    onNext: jest.fn(),
    onSkip: jest.fn(),
    ...overrides,
  };
  // `initialSensitive` is passed as an explicit JSX attribute (not spread)
  // so tsc flags it as excess/unknown until FE-5 adds it to
  // SkinTypeStepProps — see fixtures.ts header, decision 1.
  render(
    <SkinTypeStep
      initialSkinType={props.initialSkinType}
      initialSensitive={props.initialSensitive}
      onNext={props.onNext}
      onSkip={props.onSkip}
    />,
  );
  return props;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('Story 2 AC1: a secondary "Not sure?" entry sits under the chip row', () => {
  it('renders a ghost/text-style button, not the primary Next CTA', () => {
    renderStep();

    const button = screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID);
    expect(button).toBeTruthy();
    expect(screen.getByText('Not sure? Help me figure it out')).toBeTruthy();
  });

  it('opens the SkinTypeQuizSheet (question 1 becomes visible) when pressed', () => {
    renderStep();

    fireEvent.press(screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID));

    expect(
      screen.getByText('By midday, how does your skin usually feel a few hours after washing with nothing applied?'),
    ).toBeTruthy();
  });
});

describe('Story 2 AC3: dismissing the sheet mid-quiz leaves the host selection untouched', () => {
  it('closes the sheet and changes nothing when the backdrop is tapped mid-quiz', () => {
    const props = renderStep({ initialSkinType: 'oily' });
    fireEvent.press(screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID));
    fireEvent.press(screen.getByRole('radio', { name: 'Tight, rough, or flaky' }));

    fireEvent.press(screen.getByTestId('bottomsheet-backdrop'));

    expect(screen.queryByText('By midday, where (if anywhere) do you notice shine?')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Oily' }).props.accessibilityState.checked).toBe(true);
    expect(screen.queryByTestId(SOFT_COPY_HINT_TEST_ID)).toBeNull();
    fireEvent.press(screen.getByText('Next'));
    expect(props.onNext).toHaveBeenCalledWith(expect.objectContaining({ skinType: 'oily' }));
  });
});

describe('Story 3: quiz result pre-selects the chip + sensitive switch, never auto-saves', () => {
  it('pre-selects the matching chip, sets the sensitive switch, and shows a soft-copy hint on completion — without calling onNext', () => {
    const props = renderStep();

    fireEvent.press(screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID));
    answerQuizByLabels(SKINTYPE_QUIZ_ANSWERS.oily_sensitive);

    const expected = EXPECTED_SKINTYPE_RESULT.oily_sensitive;
    expect(screen.getByRole('checkbox', { name: 'Oily' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('switch', { name: SENSITIVE_LABEL }).props.accessibilityState.checked).toBe(
      expected.sensitive,
    );
    expect(screen.getByTestId(SOFT_COPY_HINT_TEST_ID)).toBeTruthy();
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('commits the pre-selected skinType and sensitive value to onNext only when Next is pressed', () => {
    const props = renderStep();

    fireEvent.press(screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID));
    answerQuizByLabels(SKINTYPE_QUIZ_ANSWERS.dry_not_sensitive);
    fireEvent.press(screen.getByText('Next'));

    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect((props.onNext as jest.Mock).mock.calls[0][0]).toMatchObject(
      EXPECTED_SKINTYPE_RESULT.dry_not_sensitive,
    );
  });

  it('discards the pre-selected quiz result when Skip is pressed instead of Next', () => {
    const props = renderStep();

    fireEvent.press(screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID));
    answerQuizByLabels(SKINTYPE_QUIZ_ANSWERS.combination_sensitive);
    fireEvent.press(screen.getByText('Skip'));

    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('clears the soft-copy hint and lets a manual chip tap win over a stale quiz result', () => {
    renderStep();

    fireEvent.press(screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID));
    answerQuizByLabels(SKINTYPE_QUIZ_ANSWERS.dry_not_sensitive); // pre-selects "Dry"

    fireEvent.press(screen.getByText('Combination')); // manual override

    expect(screen.getByRole('checkbox', { name: 'Combination' }).props.accessibilityState.checked).toBe(
      true,
    );
    expect(screen.getByRole('checkbox', { name: 'Dry' }).props.accessibilityState.checked).toBe(false);
    expect(screen.queryByTestId(SOFT_COPY_HINT_TEST_ID)).toBeNull();
  });
});

describe('Story 4: manual "Sensitive skin" toggle works independently of the quiz', () => {
  it('is off by default, matching a fresh profile\'s initialSensitive: false', () => {
    renderStep({ initialSensitive: false });

    expect(
      screen.getByRole('switch', { name: SENSITIVE_LABEL }).props.accessibilityState.checked,
    ).toBe(false);
  });

  it('seeds the switch from initialSensitive: true without any quiz being taken', () => {
    renderStep({ initialSensitive: true });

    expect(
      screen.getByRole('switch', { name: SENSITIVE_LABEL }).props.accessibilityState.checked,
    ).toBe(true);
  });

  it('saves sensitive exactly as manually toggled, independent of which skinType chip is chosen', () => {
    const props = renderStep();

    fireEvent.press(screen.getByText('Normal'));
    fireEvent.press(screen.getByRole('switch', { name: SENSITIVE_LABEL }));
    fireEvent.press(screen.getByText('Next'));

    expect((props.onNext as jest.Mock).mock.calls[0][0]).toMatchObject({
      skinType: 'normal',
      sensitive: true,
    });
  });

  it('flipping the switch does not change which chip is selected', () => {
    renderStep({ initialSkinType: 'oily' });

    fireEvent.press(screen.getByRole('switch', { name: SENSITIVE_LABEL }));

    expect(screen.getByRole('checkbox', { name: 'Oily' }).props.accessibilityState.checked).toBe(true);
  });
});
