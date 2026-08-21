/**
 * SkinProfileEditModal (Tab 4 profile editor) — Stories 2, 3, 4.
 * Spec: docs/specs/vials-onboarding-quizzes.md
 * Tech design: docs/tech-design/vials-onboarding-quizzes.md FE-8.
 *
 * `SkinProfileEditModal` already exists with no prop-signature change (FE-8
 * reads `profile.sensitive` directly in the existing pre-fill `useEffect`,
 * same as `hormoneTherapy`/`spfSensitivity`) — every test below is expected
 * to fail at runtime ("unable to find element") until FE-8 lands, and the
 * `makeProfile({ sensitive: ... })` calls are expected to fail tsc until
 * FE-1 lands. Renders the REAL `PhototypeQuizSheet`/`SkinTypeQuizSheet`/
 * `QuizSheet`/`BottomSheet` underneath, nested inside the modal's own real
 * RN `Modal` — both entry points live in the SAME tree here, which is why
 * this suite needs the testID contract (fixtures.ts decision 1) to
 * disambiguate them.
 */
import React from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

import {
  SkinProfileEditModal,
  type SkinProfileEditModalProps,
} from '@/components/profile/SkinProfileEditModal';
import { SENSITIVE_LABEL, FITZPATRICK_DESCRIPTIONS } from '@/constants/labels';
import {
  NOT_SURE_SKINTYPE_TEST_ID,
  NOT_SURE_PHOTOTYPE_TEST_ID,
  SOFT_COPY_HINT_TEST_ID,
  PHOTOTYPE_QUIZ_ANSWERS,
  SKINTYPE_QUIZ_ANSWERS,
  EXPECTED_SKINTYPE_RESULT,
  answerQuizByLabels,
  expectHintToContainText,
  makeProfile,
} from './fixtures';

function renderModal(overrides: Partial<SkinProfileEditModalProps> = {}) {
  const props: SkinProfileEditModalProps = {
    visible: true,
    profile: makeProfile(),
    onClose: jest.fn(),
    onSave: jest.fn(),
    ...overrides,
  };
  const utils = render(<SkinProfileEditModal {...props} />);
  return { props, ...utils };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('Story 2: "Not sure?" entry points for both Skin Type and Phototype fields', () => {
  it('renders a distinct entry button under each field and opens the matching sheet', () => {
    renderModal();

    expect(screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID)).toBeTruthy();
    expect(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID)).toBeTruthy();

    fireEvent.press(screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID));
    expect(
      screen.getByText('By midday, how does your skin usually feel a few hours after washing with nothing applied?'),
    ).toBeTruthy();
  });

  it('opens PhototypeQuizSheet from its own entry point, independent of the skin-type one', () => {
    renderModal();

    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));

    expect(
      screen.getByText('What is the natural tone of skin that rarely sees the sun (e.g. inner forearm)?'),
    ).toBeTruthy();
  });

  it('dismissing the phototype sheet via the backdrop leaves the current Fitzpatrick selection untouched', () => {
    const { props } = renderModal({ profile: makeProfile({ fitzpatrick: 2 }) });
    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));
    fireEvent.press(screen.getByRole('radio', { name: 'Very light, almost translucent' }));

    fireEvent.press(screen.getByTestId('bottomsheet-backdrop'));

    expect(screen.getByLabelText(/Type two/).props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByText('Save'));
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ fitzpatrick: 2 }));
  });
});

describe('Story 3: quiz results pre-select the real selector and never auto-save', () => {
  it('pre-selects the skin-type chip + sensitive switch and shows a hint, without calling onSave', () => {
    const { props } = renderModal();

    fireEvent.press(screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID));
    answerQuizByLabels(SKINTYPE_QUIZ_ANSWERS.combination_sensitive);

    const expected = EXPECTED_SKINTYPE_RESULT.combination_sensitive;
    expect(screen.getByRole('checkbox', { name: 'Combination' }).props.accessibilityState.checked).toBe(
      true,
    );
    expect(screen.getByRole('switch', { name: SENSITIVE_LABEL }).props.accessibilityState.checked).toBe(
      expected.sensitive,
    );
    expect(screen.getByTestId(SOFT_COPY_HINT_TEST_ID)).toBeTruthy();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('pre-selects the Fitzpatrick card and shows a hint naming it, without calling onSave', () => {
    const { props } = renderModal();

    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));
    answerQuizByLabels(PHOTOTYPE_QUIZ_ANSWERS.type_3_4);

    expect(screen.getByLabelText(/Type four/).props.accessibilityState.selected).toBe(true);
    expectHintToContainText(FITZPATRICK_DESCRIPTIONS[4]);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('commits the pre-selected values to onSave only when Save is pressed', () => {
    const { props } = renderModal();

    fireEvent.press(screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID));
    answerQuizByLabels(SKINTYPE_QUIZ_ANSWERS.dry_not_sensitive);
    fireEvent.press(screen.getByText('Save'));

    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect((props.onSave as jest.Mock).mock.calls[0][0]).toMatchObject(
      EXPECTED_SKINTYPE_RESULT.dry_not_sensitive,
    );
  });

  it('discards the pre-selected quiz result when Cancel is pressed instead of Save', () => {
    const { props } = renderModal();

    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));
    answerQuizByLabels(PHOTOTYPE_QUIZ_ANSWERS.type_5_6);
    fireEvent.press(screen.getByText('Cancel'));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('discards the pre-selected quiz result when the header Close button is pressed', () => {
    const { props } = renderModal();

    fireEvent.press(screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID));
    answerQuizByLabels(SKINTYPE_QUIZ_ANSWERS.oily_sensitive);
    fireEvent.press(screen.getByLabelText('Close'));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('re-seeds from the saved profile (discarding a stale quiz pre-selection) when closed and re-opened', () => {
    const profile = makeProfile({ skinType: 'normal', sensitive: false });
    const { rerender } = render(
      <SkinProfileEditModal visible profile={profile} onClose={jest.fn()} onSave={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId(NOT_SURE_SKINTYPE_TEST_ID));
    answerQuizByLabels(SKINTYPE_QUIZ_ANSWERS.oily_sensitive); // pre-selects Oily / sensitive:true

    rerender(<SkinProfileEditModal visible={false} profile={profile} onClose={jest.fn()} onSave={jest.fn()} />);
    rerender(<SkinProfileEditModal visible profile={profile} onClose={jest.fn()} onSave={jest.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Normal' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Oily' }).props.accessibilityState.checked).toBe(false);
    expect(screen.getByRole('switch', { name: SENSITIVE_LABEL }).props.accessibilityState.checked).toBe(
      false,
    );
  });

  it('clears the soft-copy hint and lets a manual selection win over a stale quiz result', () => {
    renderModal();

    fireEvent.press(screen.getByTestId(NOT_SURE_PHOTOTYPE_TEST_ID));
    answerQuizByLabels(PHOTOTYPE_QUIZ_ANSWERS.type_1_2); // pre-selects card I

    fireEvent.press(screen.getByLabelText(/Type five/)); // manual override

    expect(screen.getByLabelText(/Type five/).props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText(/Type one/).props.accessibilityState.selected).toBe(false);
    expect(screen.queryByTestId(SOFT_COPY_HINT_TEST_ID)).toBeNull();
  });
});

describe('Story 4: manual "Sensitive skin" toggle in the profile editor', () => {
  it('pre-fills from profile.sensitive on open', () => {
    renderModal({ profile: makeProfile({ sensitive: true }) });

    expect(
      screen.getByRole('switch', { name: SENSITIVE_LABEL }).props.accessibilityState.checked,
    ).toBe(true);
  });

  it('saves sensitive exactly as manually toggled with no quiz taken, independent of skinType', () => {
    const { props } = renderModal({ profile: makeProfile({ skinType: 'dry', sensitive: false }) });

    fireEvent.press(screen.getByRole('switch', { name: SENSITIVE_LABEL }));
    fireEvent.press(screen.getByText('Save'));

    expect((props.onSave as jest.Mock).mock.calls[0][0]).toMatchObject({
      skinType: 'dry',
      sensitive: true,
    });
  });
});
