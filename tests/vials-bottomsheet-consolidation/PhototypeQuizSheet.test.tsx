/**
 * Component tests — Story 4 ACs 1, 3, 4: the phototype "not sure" quiz.
 * Spec: docs/specs/vials-bottomsheet-consolidation.md §4 Story 4
 * Tech design: docs/tech-design/vials-bottomsheet-consolidation.md (FE-4)
 *
 * PhototypeQuizSheet does not exist yet — fails to resolve until FE-4 lands
 * (expected, tests-first). Exercises the REAL QuizSheet + REAL
 * scorePhototype underneath (nothing quiz-related is mocked) — this suite
 * only asserts the CONTRACT (question count, forbidden copy, onComplete's
 * output shape and absence of store/storage side effects), not the exact
 * scoring weights. Story 4 AC2 (A4 can never outweigh A1) is a pure-scoring
 * invariant and is FE-2's own co-located unit-test scope per
 * .claude/rules/testing.md and this task's explicit scope note — not
 * re-verified here. See fixtures.ts header for the full binding contract.
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

import { PhototypeQuizSheet } from '@/components/onboarding/PhototypeQuizSheet';
import { makePhototypeQuizSheetProps } from './fixtures';

const VALID_PHOTOTYPES = ['type_1_2', 'type_3_4', 'type_5_6'];
const FORBIDDEN_COPY = /eye.?colou?r|hair.?colou?r|\bethnicity\b|\brace\b|\bracial\b|\bcaucasian\b|\basian\b|\bafrican\b|\bhispanic\b|\blatino\b/i;

function extractAllText(node: any): string[] {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(extractAllText);
  if (typeof node === 'object' && 'children' in node) return extractAllText(node.children);
  return [];
}

/**
 * Walks the quiz to the end by always selecting the FIRST available answer
 * chip on each screen, then pressing "Show result" once it appears —
 * structurally agnostic to exact copy/answer count per question. Returns
 * the number of questions actually answered, and the accumulated visible
 * text of every question screen visited (for the forbidden-copy check).
 */
function walkPhototypeQuiz(maxQuestions = 8): { questionCount: number; allText: string[] } {
  const allText: string[] = [];
  for (let n = 1; n <= maxQuestions; n += 1) {
    allText.push(...extractAllText(screen.toJSON()));
    const isFinal = !!screen.queryByRole('button', { name: 'Show result' });
    const chips = screen.getAllByRole('radio');
    fireEvent.press(chips[0]);
    if (isFinal) {
      fireEvent.press(screen.getByRole('button', { name: 'Show result' }));
      return { questionCount: n, allText };
    }
    act(() => {
      jest.advanceTimersByTime(300);
    });
  }
  throw new Error(`PhototypeQuizSheet did not reach "Show result" within ${maxQuestions} questions`);
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

describe('Story 4 AC1: exactly 4 questions, no eye/hair-color question, no race/ethnicity copy', () => {
  it('asks exactly 4 questions before offering "Show result"', () => {
    render(<PhototypeQuizSheet {...makePhototypeQuizSheetProps()} />);

    const { questionCount } = walkPhototypeQuiz();

    expect(questionCount).toBe(4);
  });

  it('never renders eye-color, hair-color, or race/ethnicity copy across any of the 4 questions', () => {
    render(<PhototypeQuizSheet {...makePhototypeQuizSheetProps()} />);

    const { allText } = walkPhototypeQuiz();
    const joined = allText.join(' \n ');

    expect(joined).not.toMatch(FORBIDDEN_COPY);
  });
});

describe('Story 4 AC3: onComplete receives one of the three existing phototype buckets', () => {
  it('calls onComplete with { phototype } set to a valid SkinPhototype value', () => {
    const onComplete = jest.fn();
    render(<PhototypeQuizSheet {...makePhototypeQuizSheetProps({ onComplete })} />);

    walkPhototypeQuiz();

    expect(onComplete).toHaveBeenCalledTimes(1);
    const [result] = onComplete.mock.calls[0];
    expect(VALID_PHOTOTYPES).toContain(result.phototype);
  });
});

describe('Story 4 AC4: no UserProfile / store / storage side effect from the sheet itself', () => {
  it('never touches profileStore or the storage service while completing the quiz', () => {
    const onComplete = jest.fn();
    render(<PhototypeQuizSheet {...makePhototypeQuizSheetProps({ onComplete })} />);

    walkPhototypeQuiz();

    expect(mockUseProfileStore).not.toHaveBeenCalled();
    expect(mockSaveJson).not.toHaveBeenCalled();
    expect(mockLoadJson).not.toHaveBeenCalled();
  });
});
