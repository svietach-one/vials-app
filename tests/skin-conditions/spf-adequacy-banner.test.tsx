/**
 * Component tests for the SPF adequacy recommendation on SeasonalNoticeBanner
 * (US-29). The season is pinned by mocking getCurrentSeason — the banner reads
 * the clock internally, and a test must not depend on the month it runs in.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeProduct, makeRoutine } from './fixtures';
import type { Product, Routine, UserProfile } from '@/types';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

let mockSeason: 'summer' | 'winter' | 'autumn' | 'spring' = 'summer';
jest.mock('@/utils/timeHelpers', () => ({
  ...jest.requireActual('@/utils/timeHelpers'),
  getCurrentSeason: () => mockSeason,
}));

// Store state the banner reads. Each store mock runs its selector over a
// plain snapshot object, matching the zustand selector call shape.
let mockRoutines: Routine[] = [];
let mockProducts: Product[] = [];
let mockProfile: Partial<UserProfile> | null = null;
let mockDismissed: string[] = [];
const mockDismissBanner = jest.fn((key: string) => {
  mockDismissed = [...mockDismissed, key];
});

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: (selector: (s: unknown) => unknown) => selector({ routines: mockRoutines }),
}));
jest.mock('@/store/productsStore', () => ({
  useProductsStore: (selector: (s: unknown) => unknown) => selector({ products: mockProducts }),
}));
jest.mock('@/store/profileStore', () => ({
  useProfileStore: (selector: (s: unknown) => unknown) => selector({ profile: mockProfile }),
}));
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: (selector: (s: unknown) => unknown) =>
    selector({ dismissedBanners: mockDismissed, dismissBanner: mockDismissBanner }),
}));

import { SeasonalNoticeBanner } from '@/components/routine/SeasonalNoticeBanner';

/** A light-phototype profile with a morning SPF of the given strength. */
function arrangeMorningSpf(spfValue: number | null, fitzpatrick: 1 | 2 | 4 = 2) {
  const spf = makeProduct([], { productType: 'spf', name: 'City Fluid', spfValue });
  mockProducts = [spf];
  mockRoutines = [makeRoutine('morning', [spf])];
  mockProfile = { fitzpatrick, phototype: fitzpatrick <= 2 ? 'type_1_2' : 'type_3_4' };
}

beforeEach(() => {
  mockSeason = 'summer';
  mockRoutines = [];
  mockProducts = [];
  mockProfile = null;
  // The standing seasonal tip is dismissed in every case so assertions here
  // are about the SPF banner alone.
  mockDismissed = [`banner_${new Date().getFullYear()}_summer`];
  mockDismissBanner.mockClear();
});

describe('US-29: SPF adequacy banner', () => {
  it('recommends a stronger sunscreen for a light phototype in summer', () => {
    // Arrange
    arrangeMorningSpf(20);
    // Act
    render(<SeasonalNoticeBanner />);
    // Assert
    expect(screen.getByText('Sunscreen strength')).toBeTruthy();
    expect(screen.getByText(/Your scheduled sunscreen is SPF 20/)).toBeTruthy();
  });

  it('stays silent outside summer', () => {
    // Arrange
    arrangeMorningSpf(20);
    mockSeason = 'winter';
    mockDismissed = [`banner_${new Date().getFullYear()}_winter`];
    // Act
    render(<SeasonalNoticeBanner />);
    // Assert
    expect(screen.queryByText('Sunscreen strength')).toBeNull();
  });

  it('stays silent for a medium phototype', () => {
    // Arrange
    arrangeMorningSpf(20, 4);
    // Act
    render(<SeasonalNoticeBanner />);
    // Assert
    expect(screen.queryByText('Sunscreen strength')).toBeNull();
  });

  it('stays silent when the SPF value is unknown', () => {
    // Arrange
    arrangeMorningSpf(null);
    // Act
    render(<SeasonalNoticeBanner />);
    // Assert
    expect(screen.queryByText('Sunscreen strength')).toBeNull();
  });

  it('stays silent at exactly SPF 30', () => {
    // Arrange
    arrangeMorningSpf(30);
    // Act
    render(<SeasonalNoticeBanner />);
    // Assert
    expect(screen.queryByText('Sunscreen strength')).toBeNull();
  });

  it('dismisses under a season-and-year scoped key', () => {
    // Arrange
    arrangeMorningSpf(20);
    render(<SeasonalNoticeBanner />);
    // Act
    fireEvent.press(screen.getByLabelText('Dismiss sunscreen recommendation'));
    // Assert
    expect(mockDismissBanner).toHaveBeenCalledWith(`spf-upgrade-summer-${new Date().getFullYear()}`);
  });

  it('stays hidden once dismissed for this season', () => {
    // Arrange
    arrangeMorningSpf(20);
    mockDismissed = [...mockDismissed, `spf-upgrade-summer-${new Date().getFullYear()}`];
    // Act
    render(<SeasonalNoticeBanner />);
    // Assert
    expect(screen.queryByText('Sunscreen strength')).toBeNull();
  });

  it('renders alongside the standing seasonal tip', () => {
    // Arrange
    arrangeMorningSpf(20);
    mockDismissed = [];
    // Act
    render(<SeasonalNoticeBanner />);
    // Assert
    expect(screen.getByText('Summer skin tip')).toBeTruthy();
    expect(screen.getByText('Sunscreen strength')).toBeTruthy();
  });
});
