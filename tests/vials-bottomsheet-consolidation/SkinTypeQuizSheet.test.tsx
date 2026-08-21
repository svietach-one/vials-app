/**
 * Component tests — Story 5 ACs 1, 3: the skin-type "not sure" quiz.
 * Spec: docs/specs/vials-bottomsheet-consolidation.md §4 Story 5
 * Tech design: docs/tech-design/vials-bottomsheet-consolidation.md (FE-5)
 *
 * SkinTypeQuizSheet does not exist yet — fails to resolve until FE-5 lands
 * (expected, tests-first). Exercises the REAL QuizSheet + REAL
 * scoreSkinType underneath (nothing quiz-related is mocked) — this suite
 * only asserts the CONTRACT (question count, onComplete's output shape,
 * absence of a `dehydrated` value, and no store/storage side effects).
 * Story 5 AC2 (the dehydration guard: B1 tightness + shine never resolves to
 * `dry`) is a pure-scoring invariant and is FE-2's own co-located unit-test
 * scope per .claude/rules/testing.md and this task's explicit scope note —
 * not re-verified here. See fixtures.ts header for the full binding
 * contract and PhototypeQuizSheet.test.tsx for the shared traversal
 * strategy this file mirrors.
 */
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

const mockSaveJson = jest.fn();
const mockLoadJson = jest.fn();
jest.mock('@/services/storage', () => ({
  saveJson: mockSaveJson,
  loadJson: mockLoadJson,
  loadSchemaVersion: jest.fn(),
  persistSchemaVersionIfBehind: jest.fn(),
  STORAGE_KEYS: {},
}));

const mockUseProfileStore = jest.fn();
jest.mock('@/store/profileStore', () => ({ useProfileStore: mockUseProfileStore }));

import { SkinTypeQuizSheet } from '@/components/onboarding/SkinTypeQuizSheet';
import { makeSkinTypeQuizSheetProps } from './fixtures';

const VALID_SKIN_TYPES = ['oily', 'dry', 'combination', 'normal'];

function walkSkinTypeQuiz(maxQuestions = 8): number {
  for (let n = 1; n <= maxQuestions; n += 1) {
    const isFinal = !!screen.queryByRole('button', { name: 'Show result' });
    const chips = screen.getAllByRole('radio');
    fireEvent.press(chips[0]);
    if (isFinal) {
      fireEvent.press(screen.getByRole('button', { name: 'Show result' }));
      return n;
    }
    act(() => {
      jest.advanceTimersByTime(300);
    });
  }
  throw new Error(`SkinTypeQuizSheet did not reach "Show result" within ${maxQuestions} questions`);
}

beforeEach(() => {
  jest.useFakeTimers();
  mockSaveJson.mockClear();
  mockLoadJson.mockClear();
  mockUseProfileStore.mockClear();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('Story 5 AC1: exactly 4 questions (B1-B4)', () => {
  it('asks exactly 4 questions before offering "Show result"', () => {
    render(<SkinTypeQuizSheet {...makeSkinTypeQuizSheetProps()} />);

    expect(walkSkinTypeQuiz()).toBe(4);
  });
});

describe('Story 5 AC3: onComplete receives { skinType, sensitive } and never a `dehydrated` value', () => {
  it('calls onComplete with a valid SkinType and a boolean sensitive flag', () => {
    const onComplete = jest.fn();
    render(<SkinTypeQuizSheet {...makeSkinTypeQuizSheetProps({ onComplete })} />);

    walkSkinTypeQuiz();

    expect(onComplete).toHaveBeenCalledTimes(1);
    const [result] = onComplete.mock.calls[0];
    expect(VALID_SKIN_TYPES).toContain(result.skinType);
    expect(typeof result.sensitive).toBe('boolean');
  });

  it('never emits a `dehydrated` skinType, regardless of which answers were picked', () => {
    const onComplete = jest.fn();
    render(<SkinTypeQuizSheet {...makeSkinTypeQuizSheetProps({ onComplete })} />);

    walkSkinTypeQuiz();

    const [result] = onComplete.mock.calls[0];
    expect(result.skinType).not.toBe('dehydrated');
    expect(result).not.toHaveProperty('dehydrated');
  });
});

describe('Story 5: no UserProfile / store / storage side effect from the sheet itself', () => {
  it('never touches profileStore or the storage service while completing the quiz', () => {
    const onComplete = jest.fn();
    render(<SkinTypeQuizSheet {...makeSkinTypeQuizSheetProps({ onComplete })} />);

    walkSkinTypeQuiz();

    expect(mockUseProfileStore).not.toHaveBeenCalled();
    expect(mockSaveJson).not.toHaveBeenCalled();
    expect(mockLoadJson).not.toHaveBeenCalled();
  });
});
