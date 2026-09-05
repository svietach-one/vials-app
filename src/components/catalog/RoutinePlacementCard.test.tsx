/**
 * Component test — RoutinePlacementCard (explore-insights-v2 task 06).
 * Occupancy copy, morning-SPF copy, and the mutual-exclusion rule between
 * the two SPF variants.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@/components/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/components/ui/core/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: any) => <View>{children}</View> };
});

import { RoutinePlacementCard } from '@/components/catalog/RoutinePlacementCard';
import type { RoutineFit } from '@/hooks/useCompositionInsights';
import type { RoutinePosition } from '@/types';

function makePosition(overrides: Partial<RoutinePosition> = {}): RoutinePosition {
  return {
    eligiblePeriods: ['AM', 'PM'],
    preferredPeriod: null,
    layeringOrder: 6, // serum/gel slot -> "Treatment"
    rinseOff: false,
    confidence: 'deterministic',
    sourceRefs: [],
    ...overrides,
  };
}

const SPF_POSITION = makePosition({ layeringOrder: 13 }); // the 'spf' slot -> "Sun Protection"

function makeRoutineFit(overrides: Partial<RoutineFit> = {}): RoutineFit {
  return {
    occupants: [],
    morningSpf: 'present',
    ...overrides,
  };
}

describe('RoutinePlacementCard — occupancy copy', () => {
  it('shows "Nothing in this step yet" when the phase has no occupants', () => {
    render(<RoutinePlacementCard position={makePosition()} routineFit={makeRoutineFit({ occupants: [] })} />);

    expect(screen.getByText('Nothing in this step yet')).toBeTruthy();
  });

  it('shows "You already have {n} here: {labels}" when occupants exist', () => {
    render(
      <RoutinePlacementCard
        position={makePosition()}
        routineFit={makeRoutineFit({ occupants: [{ id: 'p1', label: 'CeraVe PM Lotion' }] })}
      />,
    );

    expect(screen.getByText('You already have 1 here: CeraVe PM Lotion')).toBeTruthy();
  });

  it('lists at most 2 occupant labels, then a "+{n} more" suffix', () => {
    render(
      <RoutinePlacementCard
        position={makePosition()}
        routineFit={makeRoutineFit({
          occupants: [
            { id: 'p1', label: 'A One' },
            { id: 'p2', label: 'B Two' },
            { id: 'p3', label: 'C Three' },
          ],
        })}
      />,
    );

    expect(screen.getByText('You already have 3 here: A One, B Two, +1 more')).toBeTruthy();
  });
});

describe('RoutinePlacementCard — morning SPF copy', () => {
  it('shows "Your morning routine still has no SPF" when absent and this composition is not itself SPF', () => {
    render(
      <RoutinePlacementCard position={makePosition()} routineFit={makeRoutineFit({ morningSpf: 'absent' })} />,
    );

    expect(screen.getByTestId('routine-morning-spf-gap')).toBeTruthy();
    expect(screen.getByText('Your morning routine still has no SPF')).toBeTruthy();
  });

  it('shows "This would fill the SPF gap in your morning routine" when absent and this composition IS sun protection', () => {
    render(
      <RoutinePlacementCard position={SPF_POSITION} routineFit={makeRoutineFit({ morningSpf: 'absent' })} />,
    );

    expect(screen.getByText('This would fill the SPF gap in your morning routine')).toBeTruthy();
    expect(screen.queryByText('Your morning routine still has no SPF')).toBeNull();
  });

  it('renders no SPF line at all when morningSpf is "present"', () => {
    render(
      <RoutinePlacementCard position={makePosition()} routineFit={makeRoutineFit({ morningSpf: 'present' })} />,
    );

    expect(screen.queryByTestId('routine-morning-spf-gap')).toBeNull();
    expect(screen.queryByText(/SPF/)).toBeNull();
  });

  it('renders no SPF line at all when morningSpf is "no-morning-routine" — never nags a user with no routine yet', () => {
    render(
      <RoutinePlacementCard
        position={makePosition()}
        routineFit={makeRoutineFit({ morningSpf: 'no-morning-routine' })}
      />,
    );

    expect(screen.queryByTestId('routine-morning-spf-gap')).toBeNull();
    expect(screen.queryByText(/SPF/)).toBeNull();
  });

  it('never renders both SPF variants together — mutual exclusion', () => {
    render(
      <RoutinePlacementCard position={makePosition()} routineFit={makeRoutineFit({ morningSpf: 'absent' })} />,
    );

    expect(screen.getAllByTestId('routine-morning-spf-gap')).toHaveLength(1);
  });
});

describe('RoutinePlacementCard — category === null gate', () => {
  it('renders the phase label with no occupancy/SPF lines when routineFit is null', () => {
    render(<RoutinePlacementCard position={makePosition()} routineFit={null} />);

    expect(screen.getByText('Treatment')).toBeTruthy();
    expect(screen.queryByTestId('routine-occupancy')).toBeNull();
    expect(screen.queryByTestId('routine-morning-spf-gap')).toBeNull();
  });
});
