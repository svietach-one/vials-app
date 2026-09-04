/**
 * AdditionalInfoStep (tech design FE-8, step 5 of 5).
 * Spec: docs/specs/onboarding-5-step-redesign.md Story 6.
 * Copy: docs/specs/profile/SCREENS_onboarding_spec.md "Step 5 of 5".
 *
 * src/screens/onboarding/steps/AdditionalInfoStep.tsx does not exist yet —
 * this file is expected to fail to import/compile until FE-8 lands (see
 * .claude/rules/testing.md: red before green).
 *
 * `InlineAlert` is spied on (real implementation kept via
 * `jest.requireActual`, wrapped in `jest.fn`) so the warning-tone assertion
 * below reads the actual `tone` prop passed to it, rather than asserting a
 * hardcoded color or reaching into internal styles.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@/components/ui/feedback/InlineAlert', () => {
  const actual = jest.requireActual('@/components/ui/feedback/InlineAlert');
  return { ...actual, InlineAlert: jest.fn(actual.InlineAlert) };
});

import { makeAdditionalInfoStepProps } from './fixtures';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { AdditionalInfoStep } from '@/screens/onboarding/steps/AdditionalInfoStep';

const TITLE = 'Anything we should know?';
const SUBTITLE =
  'Select anything that applies. This helps us avoid ingredients or procedures that may not be right for your skin.';
const PREGNANCY_LABEL = 'Pregnant or breastfeeding';
const PREGNANCY_HELPER = "We'll flag retinoids and other restricted actives.";

const CONDITION_LABELS = ['Eczema / atopic dermatitis', 'Rosacea', 'Seborrheic dermatitis'];
const CONCERN_LABELS = [
  'Acne',
  'Dryness',
  'Sensitivity',
  'Redness',
  'Wrinkles',
  'Pores',
  'Hyperpigmentation',
  'Dark spots',
];

function renderStep(overrides: Parameters<typeof makeAdditionalInfoStepProps>[0] = {}) {
  const props = makeAdditionalInfoStepProps(overrides);
  render(<AdditionalInfoStep {...props} />);
  return props;
}

beforeEach(() => {
  (InlineAlert as jest.Mock).mockClear();
});

describe('AdditionalInfoStep — copy (SCREENS_onboarding_spec.md Step 5 of 5)', () => {
  it('renders the exact title, subtitle, pregnancy label and helper text', () => {
    renderStep();

    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText(SUBTITLE)).toBeTruthy();
    expect(screen.getByText(PREGNANCY_LABEL)).toBeTruthy();
    expect(screen.getByText(PREGNANCY_HELPER)).toBeTruthy();
  });

  it('renders the skin conditions and skin concerns sections below the pregnancy card', () => {
    renderStep();

    [...CONDITION_LABELS, ...CONCERN_LABELS].forEach((label) => {
      expect(screen.getByText(label)).toBeTruthy();
    });
  });

  it('labels the primary footer button "Next" — the city step follows it', () => {
    renderStep();

    expect(screen.getByText('Next')).toBeTruthy();
    expect(screen.queryByText('Finish')).toBeNull();
  });
});

describe('AdditionalInfoStep — pregnancy toggle renders in a warning-tone InlineAlert, not a plain chip (spec Story 6 AC1)', () => {
  it('passes tone="warning" to InlineAlert', () => {
    renderStep();

    expect(InlineAlert).toHaveBeenCalled();
    const warningCall = (InlineAlert as jest.Mock).mock.calls.find(
      ([callProps]) => callProps.tone === 'warning',
    );
    expect(warningCall).toBeDefined();
  });

  it('renders the pregnancy toggle as a switch, distinct from the plain checkbox pills below it', () => {
    renderStep();

    expect(screen.getByRole('switch', { name: PREGNANCY_LABEL })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Eczema / atopic dermatitis' })).toBeTruthy();
  });
});

describe('AdditionalInfoStep — pregnancy toggle persists to pregnantOrBreastfeeding (spec Story 6 AC2/AC3)', () => {
  it('calls onNext with pregnantOrBreastfeeding: true after turning the toggle on and pressing Next', () => {
    const props = renderStep();

    fireEvent.press(screen.getByRole('switch', { name: PREGNANCY_LABEL }));
    fireEvent.press(screen.getByText('Next'));

    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect((props.onNext as jest.Mock).mock.calls[0][0]).toMatchObject({ pregnantOrBreastfeeding: true });
  });

  it('is off by default and is not required to advance', () => {
    const props = renderStep();

    expect(
      screen.getByRole('switch', { name: PREGNANCY_LABEL }).props.accessibilityState.checked,
    ).toBe(false);
    fireEvent.press(screen.getByText('Next'));
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it('does not persist the toggle, conditions, or concerns when Skip is pressed instead', () => {
    const props = renderStep();

    fireEvent.press(screen.getByRole('switch', { name: PREGNANCY_LABEL }));
    fireEvent.press(screen.getByText('Eczema / atopic dermatitis'));
    fireEvent.press(screen.getByText('Skip'));

    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onNext).not.toHaveBeenCalled();
  });
});

describe('AdditionalInfoStep — Back', () => {
  it('calls onBack when the back control is pressed', () => {
    const props = renderStep();

    fireEvent.press(screen.getByLabelText('Back'));

    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
