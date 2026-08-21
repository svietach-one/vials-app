/**
 * PhototypeStep (onboarding step 3) — Stories 2, 3.
 * Spec: docs/specs/vials-onboarding-quizzes.md
 * Tech design: docs/tech-design/vials-onboarding-quizzes.md FE-6.
 *
 * `PhototypeStep` already exists (onboarding-5-step-redesign) with no prop
 * changes needed here — FE-6 is purely internal (local quiz-visible state, a
 * "Not sure?" button, `deriveFitzpatrick`-based pre-selection, a soft-copy
 * hint built from `FITZPATRICK_DESCRIPTIONS` once FE-4 hoists it into
 * `labels.ts`). Every test below is expected to fail at runtime ("unable to
 * find element") until FE-6 lands — red-before-green. Renders the REAL
 * `PhototypeQuizSheet`/`QuizSheet`/`BottomSheet` underneath.
 */
import React from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

import { PhototypeStep, type PhototypeStepProps } from '@/screens/onboarding/steps/PhototypeStep';
import { FITZPATRICK_DESCRIPTIONS } from '@/constants/labels';
import {
  NOT_SURE_PHOTOTYPE_TEST_ID,
  SOFT_COPY_HINT_TEST_ID,
  PHOTOTYPE_QUIZ_ANSWERS,
  EXPECTED_FITZPATRICK_FOR_BUCKET,
  answerQuizByLabels,
  expectHintToContainText,
} from './fixtures';

function renderStep(overrides: Partial<PhototypeStepProps> = {}) {
  const props: PhototypeStepProps = {
    initialFitzpatrick: null,
    onNext: jest.fn(),
    onSkip: jest.fn(),
    onBack: jest.fn(),
    ...overrides,
  };
  render(<PhototypeStep {...props} />);
  return props;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('Story 2 AC2: a secondary "Not sure?" entry sits under the 6-card grid', () => {
  it('renders the entry button under the grid and opens PhototypeQuizSheet on press', () => {
    renderStep();

    expect(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID)).toBeTruthy();
    expect(screen.getByText('Not sure? Help me figure it out')).toBeTruthy();

    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));

    expect(
      screen.getByText('What is the natural tone of skin that rarely sees the sun (e.g. inner forearm)?'),
    ).toBeTruthy();
  });
});

describe('Story 2 AC3: dismissing the sheet mid-quiz leaves the host selection untouched', () => {
  it('closes the sheet and changes nothing when the backdrop is tapped mid-quiz', () => {
    const props = renderStep({ initialFitzpatrick: 2 });
    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));
    fireEvent.press(screen.getByRole('radio', { name: 'Very light, almost translucent' }));

    fireEvent.press(screen.getByTestId('bottomsheet-backdrop'));

    expect(screen.queryByText('How does your skin react to sun with no protection?')).toBeNull();
    expect(screen.getByLabelText(/Type two/).props.accessibilityState.selected).toBe(true);
    expect(screen.queryByTestId(SOFT_COPY_HINT_TEST_ID)).toBeNull();
    fireEvent.press(screen.getByText('Next'));
    expect(props.onNext).toHaveBeenCalledWith(expect.objectContaining({ fitzpatrick: 2 }));
  });
});

describe('Story 3: quiz result pre-selects the safety-first FitzpatrickCard via deriveFitzpatrick, never auto-saves', () => {
  it('pre-selects card IV for a type_3_4 quiz result and shows a soft-copy hint naming it — without calling onNext', () => {
    const props = renderStep();

    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));
    answerQuizByLabels(PHOTOTYPE_QUIZ_ANSWERS.type_3_4);

    const expectedType = EXPECTED_FITZPATRICK_FOR_BUCKET.type_3_4; // 4
    expect(screen.getByLabelText(/Type four/).props.accessibilityState.selected).toBe(true);
    expectHintToContainText(FITZPATRICK_DESCRIPTIONS[expectedType]);
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('pre-selects card I for a type_1_2 result and card VI for a type_5_6 result', () => {
    const { unmount } = render(
      <PhototypeStep initialFitzpatrick={null} onNext={jest.fn()} onSkip={jest.fn()} onBack={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));
    answerQuizByLabels(PHOTOTYPE_QUIZ_ANSWERS.type_1_2);
    expect(screen.getByLabelText(/Type one/).props.accessibilityState.selected).toBe(true);
    unmount();

    render(<PhototypeStep initialFitzpatrick={null} onNext={jest.fn()} onSkip={jest.fn()} onBack={jest.fn()} />);
    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));
    answerQuizByLabels(PHOTOTYPE_QUIZ_ANSWERS.type_5_6);
    expect(screen.getByLabelText(/Type six/).props.accessibilityState.selected).toBe(true);
  });

  it('commits the pre-selected fitzpatrick value to onNext only when Next is pressed', () => {
    const props = renderStep();

    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));
    answerQuizByLabels(PHOTOTYPE_QUIZ_ANSWERS.type_3_4);
    fireEvent.press(screen.getByText('Next'));

    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect((props.onNext as jest.Mock).mock.calls[0][0]).toMatchObject({ fitzpatrick: 4 });
  });

  it('discards the pre-selected quiz result when Skip is pressed instead of Next', () => {
    const props = renderStep();

    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));
    answerQuizByLabels(PHOTOTYPE_QUIZ_ANSWERS.type_5_6);
    fireEvent.press(screen.getByText('Skip'));

    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('clears the soft-copy hint and lets a manual card tap win over a stale quiz result', () => {
    renderStep();

    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));
    answerQuizByLabels(PHOTOTYPE_QUIZ_ANSWERS.type_1_2); // pre-selects card I

    fireEvent.press(screen.getByLabelText(/Type five/)); // manual override

    expect(screen.getByLabelText(/Type five/).props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText(/Type one/).props.accessibilityState.selected).toBe(false);
    expect(screen.queryByTestId(SOFT_COPY_HINT_TEST_ID)).toBeNull();
  });
});
