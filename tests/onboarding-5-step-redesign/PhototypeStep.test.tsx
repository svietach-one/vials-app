/**
 * PhototypeStep (tech design FE-6, step 3 of 5).
 * Spec: docs/specs/onboarding-5-step-redesign.md Story 4.
 * Copy: docs/specs/profile/SCREENS_onboarding_spec.md "Step 3 of 5".
 *
 * src/screens/onboarding/steps/PhototypeStep.tsx does not exist yet — this
 * file is expected to fail to import/compile until FE-6 lands (see
 * .claude/rules/testing.md: red before green).
 *
 * Resolved OQ-1 (2026-07-27): reuses the already-shipped 6-card
 * FitzpatrickCard, not a 3-grouped-card component — assertions below lock in
 * 6 cards. Per tech design Assumption 2, the existing FITZPATRICK_A11Y
 * strings (src/components/onboarding/PhototypeCard.tsx) are kept verbatim,
 * NOT rewritten to match SCREENS_onboarding_spec.md's accessibilityLabel
 * table — assertions below match the shipped strings, not the reference doc.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makePhototypeStepProps } from './fixtures';
import { PhototypeStep } from '@/screens/onboarding/steps/PhototypeStep';

const TITLE = 'How does your skin react to the sun?';
const SUBTITLE = 'This helps us tailor product and procedure recommendations.';

// Shipped a11y strings (PhototypeCard.tsx FITZPATRICK_A11Y) — kept verbatim
// per tech design Assumption 2.
const EXISTING_A11Y = [
  /Type one: very fair skin, always burns, never tans, highest UV sensitivity/,
  /Type two: fair skin, burns easily, tans minimally/,
  /Type three: light olive skin, sometimes burns, tans gradually/,
  /Type four: olive or light brown skin, rarely burns, tans easily, prone to dark spots/,
  /Type five: brown skin, very rarely burns, elevated post-inflammatory pigmentation risk/,
  /Type six: deep brown skin, almost never burns, highest laser and peel caution/,
];

function renderStep(overrides: Parameters<typeof makePhototypeStepProps>[0] = {}) {
  const props = makePhototypeStepProps(overrides);
  render(<PhototypeStep {...props} />);
  return props;
}

describe('PhototypeStep — copy (SCREENS_onboarding_spec.md Step 3 of 5)', () => {
  it('renders the exact title and subtitle', () => {
    renderStep();

    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText(SUBTITLE)).toBeTruthy();
  });
});

describe('PhototypeStep — renders all 6 FitzpatrickCards (resolved OQ-1: 6-card, not 3-grouped)', () => {
  it('renders exactly six selectable radio cards with roman numerals I-VI visible', () => {
    renderStep();

    expect(screen.getAllByRole('radio')).toHaveLength(6);
    ['I', 'II', 'III', 'IV', 'V', 'VI'].forEach((numeral) => {
      expect(screen.getByText(numeral)).toBeTruthy();
    });
  });

  it('gives each card its own distinct existing accessibilityLabel (tech design Assumption 2 — kept verbatim)', () => {
    renderStep();

    EXISTING_A11Y.forEach((pattern) => {
      expect(screen.getByLabelText(pattern)).toBeTruthy();
    });
  });

  it('renders every card as the same fixed-size rectangle, regardless of its caption\'s wrapped line count', () => {
    // Regression: a flex/aspectRatio-based card size inside this grid's
    // auto-height column items resolved inconsistently depending on which
    // row-mate had the longest wrapped caption — some cards rendered taller
    // than others. A fixed height sidesteps that ambiguity entirely.
    renderStep();

    const cards = screen.getAllByRole('radio');
    const heights = cards.map((card) => StyleSheet.flatten(card.props.style).height);
    expect(heights).toEqual(new Array(6).fill(heights[0]));
    expect(heights[0]).toBeGreaterThan(0);
  });
});

describe('PhototypeStep — Next disabled until a value is chosen (tech design Assumption 7)', () => {
  it('does not call onNext when Next is pressed before any card is chosen', () => {
    const props = renderStep();

    fireEvent.press(screen.getByText('Next'));

    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('calls onNext with the chosen fitzpatrick type after selecting a card', () => {
    const props = renderStep();

    fireEvent.press(screen.getByLabelText(/Type three/));
    fireEvent.press(screen.getByText('Next'));

    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect((props.onNext as jest.Mock).mock.calls[0][0]).toMatchObject({ fitzpatrick: 3 });
  });
});

describe('PhototypeStep — Skip and Back', () => {
  it('calls onSkip and never calls onNext when Skip is pressed, even after choosing a card', () => {
    const props = renderStep();

    fireEvent.press(screen.getByLabelText(/Type one/));
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
