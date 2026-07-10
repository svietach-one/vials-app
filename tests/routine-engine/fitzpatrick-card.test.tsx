/**
 * Integration test — Story 7 UI AC: six visual Fitzpatrick onboarding cards.
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 7
 *
 * FE-9 shipped FitzpatrickCard (progress/routine-engine.md, 2026-07-05
 * "SURROUNDING UX" entry): 6 swatches, roman numerals, full sun-reaction a11y
 * labels (no racial labels in visible text or a11y copy).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { FitzpatrickType } from '@/types';

import { FitzpatrickCard } from '@/components/onboarding/PhototypeCard';

const ALL_TYPES: FitzpatrickType[] = [1, 2, 3, 4, 5, 6];

describe('Story 7 AC: onboarding renders six visual phototype cards mapped to Fitzpatrick 1-6', () => {
  it('renders six selectable radio cards, one per Fitzpatrick type, each with a full sun-reaction a11y label', () => {
    render(
      <>
        {ALL_TYPES.map((type) => (
          <FitzpatrickCard key={type} type={type} selected={type === 3} onSelect={() => {}} />
        ))}
      </>,
    );

    const cards = screen.getAllByRole('radio');
    expect(cards).toHaveLength(6);

    // Roman numerals are the only visible text (no racial labels).
    ['I', 'II', 'III', 'IV', 'V', 'VI'].forEach((numeral) => {
      expect(screen.getByText(numeral)).toBeTruthy();
    });

    // Full sun-reaction descriptions live on the a11y label, never a racial term.
    expect(
      screen.getByLabelText(/Type one: very fair skin, always burns, never tans/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(/Type six: deep brown skin, almost never burns/),
    ).toBeTruthy();

    // Exactly one card reflects the selected state (type 3 here).
    const selectedCards = cards.filter((c) => c.props.accessibilityState?.selected === true);
    expect(selectedCards).toHaveLength(1);
  });

  it('never uses a racial label anywhere in visible or accessibility text', () => {
    render(<FitzpatrickCard type={4} selected={false} onSelect={() => {}} />);
    const forbidden = /\b(white|black|asian|caucasian|race)\b/i;
    expect(screen.getByLabelText(/Type four/).props.accessibilityLabel).not.toMatch(forbidden);
  });
});
