/**
 * Component tests — Story 3 ACs 1-5: the generic `QuizSheet` shell (progress
 * indicator, one question per screen, chip auto-advance, back navigation,
 * final-question explicit action, discard-on-dismiss).
 * Spec: docs/specs/vials-bottomsheet-consolidation.md §4 Story 3
 * Tech design: docs/tech-design/vials-bottomsheet-consolidation.md (FE-3)
 *
 * QuizSheet does not exist yet — this file fails to resolve until FE-3
 * lands, per fixtures.ts's binding contract (a11y roles/labels, callback
 * naming). Expected (tests-first). Driven with a content-agnostic 3-question
 * dummy set (DUMMY_QUIZ_QUESTIONS) — QuizSheet takes questions/answers/
 * scoring as props per tech design §3 FE-3, so this suite never needs real
 * phototype/skin-type copy; that belongs to PhototypeQuizSheet.test.tsx /
 * SkinTypeQuizSheet.test.tsx.
 *
 * QuizSheet renders on the real (unmocked) BottomSheet underneath — only the
 * native/heavy boundary (react-native-safe-area-context) is mocked.
 */
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

import { QuizSheet } from '@/components/onboarding/QuizSheet';
import { DUMMY_QUIZ_QUESTIONS, makeQuizSheetProps } from './fixtures';

function progressLabel(step: number, total: number) {
  return new RegExp(`^Step ${step} of ${total}$`);
}

function answerChip(label: string) {
  return screen.getByRole('radio', { name: label });
}

function pressAndAdvance(label: string, ms = 300) {
  fireEvent.press(answerChip(label));
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('Story 3 AC1: one question at a time, with a progress indicator', () => {
  it('shows only the first question\'s text and an accessible "Step 1 of 3" progress label', () => {
    render(<QuizSheet {...makeQuizSheetProps()} />);

    expect(screen.getByText('Dummy question one?')).toBeTruthy();
    expect(screen.queryByText('Dummy question two?')).toBeNull();
    expect(screen.queryByText('Dummy question three?')).toBeNull();
    expect(screen.getByLabelText(progressLabel(1, 3))).toBeTruthy();
  });

  it('advances the progress label to "Step 2 of 3" after answering question 1', () => {
    render(<QuizSheet {...makeQuizSheetProps()} />);

    pressAndAdvance('Answer A');

    expect(screen.getByLabelText(progressLabel(2, 3))).toBeTruthy();
    expect(screen.getByText('Dummy question two?')).toBeTruthy();
  });
});

describe('Story 3 AC2: tapping a chip auto-advances ~250-300ms later, no "Next" button', () => {
  it('does not render a "Next" button on any non-final question', () => {
    render(<QuizSheet {...makeQuizSheetProps()} />);

    expect(screen.queryByText('Next')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('stays on question 1 immediately after the tap and before the delay elapses', () => {
    render(<QuizSheet {...makeQuizSheetProps()} />);

    fireEvent.press(answerChip('Answer A'));
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(screen.getByText('Dummy question one?')).toBeTruthy();
    expect(screen.queryByText('Dummy question two?')).toBeNull();
  });

  it('advances to question 2 once ~250-300ms have elapsed since the tap', () => {
    render(<QuizSheet {...makeQuizSheetProps()} />);

    fireEvent.press(answerChip('Answer A'));
    act(() => {
      jest.advanceTimersByTime(260);
    });

    expect(screen.getByText('Dummy question two?')).toBeTruthy();
    expect(screen.queryByText('Dummy question one?')).toBeNull();
  });
});

describe('Story 3 AC3: the final question shows an explicit "Show result" button instead of auto-advancing', () => {
  it('reaches question 3 and shows "Show result" instead of a further auto-advance', () => {
    render(<QuizSheet {...makeQuizSheetProps()} />);

    pressAndAdvance('Answer A');
    pressAndAdvance('Answer C');

    expect(screen.getByText('Dummy question three?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show result' })).toBeTruthy();
  });

  it('does not auto-advance/complete on the final question merely from tapping a chip', () => {
    const onComplete = jest.fn();
    render(<QuizSheet {...makeQuizSheetProps({ onComplete })} />);

    pressAndAdvance('Answer A');
    pressAndAdvance('Answer C');
    fireEvent.press(answerChip('Answer E'));
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Dummy question three?')).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete with the scored answers when "Show result" is pressed on the final question', () => {
    const onComplete = jest.fn();
    render(<QuizSheet {...makeQuizSheetProps({ onComplete })} />);

    pressAndAdvance('Answer A');
    pressAndAdvance('Answer C');
    fireEvent.press(answerChip('Answer E'));
    fireEvent.press(screen.getByRole('button', { name: 'Show result' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ q1: 'q1-a', q2: 'q2-a', q3: 'q3-a' });
  });
});

describe('Story 3 AC4: back arrow — hidden on question 1, present after, preserves the prior selection', () => {
  it('renders no Back button on question 1', () => {
    render(<QuizSheet {...makeQuizSheetProps()} />);

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('shows Back from question 2 onward and returns to question 1 with its answer still selected', () => {
    render(<QuizSheet {...makeQuizSheetProps()} />);

    pressAndAdvance('Answer A');
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByText('Dummy question one?')).toBeTruthy();
    expect(answerChip('Answer A').props.accessibilityState?.selected).toBe(true);
  });
});

describe('Story 3 AC5: dismissing mid-quiz discards answers and emits no result', () => {
  it('calls onDismiss (never onComplete) when the backdrop is tapped mid-quiz', () => {
    const onDismiss = jest.fn();
    const onComplete = jest.fn();
    render(<QuizSheet {...makeQuizSheetProps({ onDismiss, onComplete })} />);

    pressAndAdvance('Answer A');
    fireEvent.press(screen.getByTestId('bottomsheet-backdrop'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('starts over at question 1 with nothing selected when re-opened after a mid-quiz dismiss', () => {
    const { rerender } = render(<QuizSheet {...makeQuizSheetProps({ visible: true })} />);

    pressAndAdvance('Answer A');
    expect(screen.getByText('Dummy question two?')).toBeTruthy();

    rerender(<QuizSheet {...makeQuizSheetProps({ visible: false })} />);
    rerender(<QuizSheet {...makeQuizSheetProps({ visible: true })} />);

    expect(screen.getByText('Dummy question one?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(answerChip('Answer A').props.accessibilityState?.selected).not.toBe(true);
  });
});
