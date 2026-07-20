/**
 * ContributionConsentMigrationBanner (tech design FE-6, spec Story 3).
 * Dumb presenter — same pattern as GoalConfirmBanner (see
 * tests/routine-engine/goal-confirm-banner.test.tsx): the one-time-per-install
 * visibility logic and store access belong to the host (RoutinesScreen), not
 * this component. This file only proves the presenter renders the right copy
 * and forwards its two callbacks — no store or navigation import here, by
 * design, so this component stays reusable and independently testable.
 *
 * Component not yet written by the engineer — this file is expected to fail
 * to import/compile until FE-6 lands.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeMigrationBannerProps } from './fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

import { ContributionConsentMigrationBanner } from '@/components/routine/ContributionConsentMigrationBanner';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ContributionConsentMigrationBanner — copy', () => {
  it('renders the title, body, and both action labels', () => {
    render(<ContributionConsentMigrationBanner {...makeMigrationBannerProps()} />);

    expect(screen.getByText('Share photos with Vials?')).toBeTruthy();
    expect(
      screen.getByText(
        'You can now choose to share product photos with the Vials community database. Manage this anytime in Settings.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Go to Settings')).toBeTruthy();
    expect(screen.getByText('Dismiss')).toBeTruthy();
  });
});

describe('ContributionConsentMigrationBanner — actions', () => {
  it('calls onGoToSettings exactly once when "Go to Settings" is tapped', () => {
    const props = makeMigrationBannerProps();
    render(<ContributionConsentMigrationBanner {...props} />);

    fireEvent.press(screen.getByText('Go to Settings'));

    expect(props.onGoToSettings).toHaveBeenCalledTimes(1);
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it('calls onDismiss exactly once when "Dismiss" is tapped', () => {
    const props = makeMigrationBannerProps();
    render(<ContributionConsentMigrationBanner {...props} />);

    fireEvent.press(screen.getByText('Dismiss'));

    expect(props.onDismiss).toHaveBeenCalledTimes(1);
    expect(props.onGoToSettings).not.toHaveBeenCalled();
  });
});
