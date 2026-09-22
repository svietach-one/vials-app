/**
 * Component test — GoalFitCard (explore-fit-signals FE-2).
 * Spec: docs/specs/explore-fit-signals.md §4 Story 1
 * Tech design: docs/tech-design/explore-fit-signals.md §3 FE-1/FE-2
 *
 * `src/components/catalog/GoalFitCard.tsx` does not exist yet — every test
 * below is EXPECTED to fail to compile/run until FE-1/FE-2 land, same
 * qa-lead-before-engineer convention as every other file in this task.
 *
 * Copy wording (`buildGoalFitMatchMessage`/`buildGoalFitMissMessage`, FE-1)
 * is `PLACEHOLDER` — spec §10 Open Question 4, still open, owner: design.
 * Assertions below target the copy PATTERN (names the active label and/or
 * the goal label, never a score/percentage) and the structural/testID
 * contract, not a literal sentence, so this file does not need rewriting
 * once final copy lands — only FE-1's literal strings do.
 *
 * Open Questions 1 and 2 (spec §10) are both RESOLVED as of 2026-09-14: the
 * miss branch is a required rendering (not a stub), and two simultaneous
 * findings render as ONE card with one row per goal (never two cards, never
 * a silently dropped goal) — both are exercised below as real, non-skipped
 * assertions.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@/components/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/components/ui/core/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: any) => <View>{children}</View> };
});

import { GoalFitCard } from '@/components/catalog/GoalFitCard';
import { ACTIVE_INGREDIENT_LABELS, GOAL_LABELS } from '@/constants/labels';
import type { GoalFitFinding } from '@/utils/productProfile/goalFit';
import { makeGoalFitFinding } from './fixtures';

function renderCard(goalFit: GoalFitFinding[]) {
  return render(<GoalFitCard goalFit={goalFit} />);
}

describe('GoalFitCard — no real goal set (primaryGoal maintenance, secondaryGoal null)', () => {
  it('renders nothing at all when goalFit is empty', () => {
    const { toJSON } = renderCard([]);

    expect(toJSON()).toBeNull();
  });

  it('renders no card, placeholder, or nudge testID when there is nothing to show', () => {
    renderCard([]);

    expect(screen.queryByTestId('goal-fit-card')).toBeNull();
    expect(screen.queryByTestId(/^goal-fit-row-/)).toBeNull();
  });
});

describe('GoalFitCard — single goal, match branch (an overlapping active exists)', () => {
  it('names the matching active and the goal in a factual sentence', () => {
    renderCard([makeGoalFitFinding({ goal: 'acne', matchedKeys: ['niacinamide'] })]);

    const row = within(screen.getByTestId('goal-fit-card')).getByTestId('goal-fit-row-acne');
    expect(within(row).getByText(new RegExp(ACTIVE_INGREDIENT_LABELS.niacinamide, 'i'))).toBeTruthy();
    expect(within(row).getByText(new RegExp(GOAL_LABELS.acne, 'i'))).toBeTruthy();
  });

  it('names every matched active when more than one overlaps the same goal', () => {
    renderCard([makeGoalFitFinding({ goal: 'pigmentation', matchedKeys: ['azelaic_acid', 'niacinamide'] })]);

    const row = within(screen.getByTestId('goal-fit-card')).getByTestId('goal-fit-row-pigmentation');
    expect(within(row).getByText(new RegExp(ACTIVE_INGREDIENT_LABELS.azelaic_acid, 'i'))).toBeTruthy();
    expect(within(row).getByText(new RegExp(ACTIVE_INGREDIENT_LABELS.niacinamide, 'i'))).toBeTruthy();
  });

  it('never invents a score, percentage, or confidence value in the match sentence', () => {
    renderCard([makeGoalFitFinding({ goal: 'acne', matchedKeys: ['niacinamide'] })]);

    const row = screen.getByTestId('goal-fit-row-acne');
    expect(within(row).queryByText(/%/)).toBeNull();
    expect(within(row).queryByText(/\bscore\b|\bconfidence\b|\bmatch rate\b/i)).toBeNull();
  });
});

describe('GoalFitCard — single goal, miss branch (Open Question 1, RESOLVED: SHOW the honest miss sentence)', () => {
  it('renders a real row naming the goal when matchedKeys is empty — never a silently dropped/stubbed branch', () => {
    renderCard([makeGoalFitFinding({ goal: 'dehydration', matchedKeys: [] })]);

    const card = screen.getByTestId('goal-fit-card');
    const row = within(card).getByTestId('goal-fit-row-dehydration');
    expect(within(row).getByText(new RegExp(GOAL_LABELS.dehydration, 'i'))).toBeTruthy();
  });

  it('never invents a score, percentage, or confidence value in the miss sentence either', () => {
    renderCard([makeGoalFitFinding({ goal: 'dehydration', matchedKeys: [] })]);

    const row = screen.getByTestId('goal-fit-row-dehydration');
    expect(within(row).queryByText(/%/)).toBeNull();
    expect(within(row).queryByText(/\bscore\b|\bconfidence\b/i)).toBeNull();
  });

  it('does not falsely claim an active match when there is none', () => {
    renderCard([makeGoalFitFinding({ goal: 'oil_control', matchedKeys: [] })]);

    // No active label from ACTIVE_INGREDIENT_LABELS should be claimed as a
    // finding inside this miss row (a stray label would indicate the match
    // branch rendered instead of the miss branch). Labels are escaped before
    // building a RegExp since several (e.g. "Vitamin C (Pure)") contain
    // regex metacharacters.
    const row = screen.getByTestId('goal-fit-row-oil_control');
    for (const label of Object.values(ACTIVE_INGREDIENT_LABELS)) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(within(row).queryByText(new RegExp(escaped, 'i'))).toBeNull();
    }
  });
});

describe('GoalFitCard — two simultaneous goal findings (Open Question 2, RESOLVED: one card, one line per goal)', () => {
  it('renders exactly ONE card element, never two separate cards', () => {
    renderCard([
      makeGoalFitFinding({ goal: 'acne', matchedKeys: ['niacinamide'] }),
      makeGoalFitFinding({ goal: 'dehydration', matchedKeys: [] }),
    ]);

    expect(screen.getAllByTestId('goal-fit-card')).toHaveLength(1);
  });

  it('renders one row per goal — match + match', () => {
    renderCard([
      makeGoalFitFinding({ goal: 'acne', matchedKeys: ['niacinamide'] }),
      makeGoalFitFinding({ goal: 'barrier_repair', matchedKeys: ['ceramides'] }),
    ]);

    const card = screen.getByTestId('goal-fit-card');
    expect(within(card).getAllByTestId(/^goal-fit-row-/)).toHaveLength(2);
    expect(within(card).getByTestId('goal-fit-row-acne')).toBeTruthy();
    expect(within(card).getByTestId('goal-fit-row-barrier_repair')).toBeTruthy();
  });

  it('never silently drops one goal when the other has a finding too — match + miss combination', () => {
    renderCard([
      makeGoalFitFinding({ goal: 'acne', matchedKeys: ['niacinamide'] }),
      makeGoalFitFinding({ goal: 'aging', matchedKeys: [] }),
    ]);

    const card = screen.getByTestId('goal-fit-card');
    const acneRow = within(card).getByTestId('goal-fit-row-acne');
    const agingRow = within(card).getByTestId('goal-fit-row-aging');
    expect(within(acneRow).getByText(new RegExp(GOAL_LABELS.acne, 'i'))).toBeTruthy();
    expect(within(agingRow).getByText(new RegExp(GOAL_LABELS.aging, 'i'))).toBeTruthy();
  });

  it('never silently drops one goal when both are misses', () => {
    renderCard([
      makeGoalFitFinding({ goal: 'aging', matchedKeys: [] }),
      makeGoalFitFinding({ goal: 'oil_control', matchedKeys: [] }),
    ]);

    const card = screen.getByTestId('goal-fit-card');
    expect(within(card).getAllByTestId(/^goal-fit-row-/)).toHaveLength(2);
  });
});
