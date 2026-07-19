/**
 * PhototypeConfirmBanner contract (V2.1 phase-08 §8.1): shown once for
 * profiles whose Fitzpatrick was auto-derived on migration; Confirm clears the
 * flag, Change routes to the profile editor. Dumb presenter — the once-only
 * behavior lives in the host (RoutinesScreen renders it only while
 * phototypeNeedsConfirmation).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PhototypeConfirmBanner } from '@/components/routine/PhototypeConfirmBanner';

describe('PhototypeConfirmBanner', () => {
  it('names the derived Fitzpatrick number in the banner copy', () => {
    render(<PhototypeConfirmBanner fitzpatrick={4} onConfirm={jest.fn()} onAdjust={jest.fn()} />);
    expect(screen.getByText(/Fitzpatrick 4/)).toBeTruthy();
  });

  it('confirms on the confirm button', () => {
    const onConfirm = jest.fn();
    render(<PhototypeConfirmBanner fitzpatrick={6} onConfirm={onConfirm} onAdjust={jest.fn()} />);
    fireEvent.press(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('routes to adjustment on the change button', () => {
    const onAdjust = jest.fn();
    render(<PhototypeConfirmBanner fitzpatrick={2} onConfirm={jest.fn()} onAdjust={onAdjust} />);
    fireEvent.press(screen.getByText('Change'));
    expect(onAdjust).toHaveBeenCalledTimes(1);
  });
});
