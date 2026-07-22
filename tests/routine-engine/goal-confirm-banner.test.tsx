/**
 * GoalConfirmBanner contract (V2.1 phase-03 §3.1): shown once for profiles
 * whose goal was heuristically derived from concerns; confirming clears the
 * flag, adjusting routes to the profile editor. The one-time behavior lives
 * in the host (RoutinesScreen renders it only while goalNeedsConfirmation) —
 * the banner itself is a dumb presenter.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { GoalConfirmBanner } from '@/components/routine/GoalConfirmBanner';

describe('GoalConfirmBanner', () => {
  it('names the derived goal in the banner copy', () => {
    render(
      <GoalConfirmBanner goalLabel="Anti-aging" onConfirm={jest.fn()} onAdjust={jest.fn()} />,
    );

    expect(screen.getByText(/Anti-aging/)).toBeTruthy();
  });

  it('confirms on the confirm button', () => {
    const onConfirm = jest.fn();
    render(
      <GoalConfirmBanner goalLabel="Anti-aging" onConfirm={onConfirm} onAdjust={jest.fn()} />,
    );

    fireEvent.press(screen.getByText('Confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('routes to adjustment on the change button', () => {
    const onAdjust = jest.fn();
    render(
      <GoalConfirmBanner goalLabel="Anti-aging" onConfirm={jest.fn()} onAdjust={onAdjust} />,
    );

    fireEvent.press(screen.getByText('Change'));

    expect(onAdjust).toHaveBeenCalledTimes(1);
  });
});
