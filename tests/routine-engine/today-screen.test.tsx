/**
 * Integration tests — Story 5 UI ACs: the "Complete My Routine" check-in
 * button only exists in dynamic mode, is a single global action (no
 * per-product checkboxes), and fixed mode maps steps statically via
 * scheduledDays with no button at all.
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 5
 *
 * FE-9 shipped TodayScreen's real daily view + check-in button
 * (progress/routine-engine.md, 2026-07-05 "SURROUNDING UX" entry). Mocking
 * follows the boundary playbook in
 * tests/routines/routines-screen-hidden-filter.test.tsx (navigation-free here
 * since TodayScreen takes no navigation prop).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { Product, Routine } from '@/types';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

jest.mock('@/domain/trackingActions', () => ({
  performDailyCheckIn: jest.fn(),
}));

jest.mock('@/domain/seasonActions', () => ({
  getActiveSeasonMask: jest.fn(() => ({ season: 'spring', source: 'calendar' })),
}));

let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];
let mockCycleType: 'fixed' | 'dynamic' = 'fixed';
let mockCycleState = { cyclePhaseIndex: 0 as const, lastAppliedDate: null as string | null };

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) => selector({ routines: mockRoutines })),
}));

jest.mock('@/store/proceduresStore', () => ({
  useProceduresStore: jest.fn((selector: any) => selector({ procedures: [] })),
}));

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: null })),
}));

jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: any) => selector({ routineCycleType: mockCycleType })),
}));

jest.mock('@/store/trackingStore', () => ({
  useTrackingStore: jest.fn((selector: any) => selector({ cycleState: mockCycleState })),
}));

import TodayScreen from '@/screens/TodayScreen';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p-default',
    name: 'Gentle Cleanser',
    brand: null,
    productType: 'cleanser',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

const PRODUCT = makeProduct({ id: 'p1', name: 'Gentle Cleanser' });

beforeEach(() => {
  jest.clearAllMocks();
  mockProducts = [PRODUCT];
  mockRoutines = [
    {
      id: 'routine-evening',
      name: 'Evening',
      timeOfDay: 'evening',
      steps: [{ id: 'step-1', productType: 'cleanser', productId: PRODUCT.id, hidden: false, scheduledDays: [] }],
    },
  ];
  mockCycleState = { cyclePhaseIndex: 0, lastAppliedDate: null };
});

describe('Story 5 AC: fixed mode (default) shows no check-in button and maps steps statically', () => {
  it('renders the scheduled product with no "Complete My Routine" button anywhere on screen', () => {
    mockCycleType = 'fixed';
    render(<TodayScreen />);

    expect(screen.getByText('Gentle Cleanser')).toBeTruthy();
    expect(screen.queryByLabelText('Complete My Routine')).toBeNull();
    expect(screen.queryByText('Complete My Routine')).toBeNull();
  });
});

describe('Story 5 AC: dynamic mode shows exactly one global check-in button, no per-product checkboxes', () => {
  it('renders a single "Complete My Routine" action and no per-step checkbox controls', () => {
    mockCycleType = 'dynamic';
    render(<TodayScreen />);

    const button = screen.getByLabelText('Complete My Routine');
    expect(button).toBeTruthy();
    // Exactly one check-in entry point — never one per product/step.
    expect(screen.getAllByLabelText('Complete My Routine')).toHaveLength(1);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('disables the button and hides the check-in hint once already checked in today', () => {
    mockCycleType = 'dynamic';
    // getSkincareDateString(new Date()) at render time — simplest deterministic
    // proxy is to check in "now" and read the resulting state instead of
    // hardcoding today's date string (avoids a timezone-flaky fixture).
    const { getSkincareDateString } = require('@/utils/timeHelpers');
    mockCycleState = { cyclePhaseIndex: 0, lastAppliedDate: getSkincareDateString(new Date()) };

    render(<TodayScreen />);

    const button = screen.getByLabelText('Complete My Routine');
    expect(button.props.accessibilityState.disabled).toBe(true);
    // The "one tap per day" hint only renders while unchecked — its absence
    // is a robust proxy for the completed-copy swap without querying text
    // nested inside the Pressable's own accessibilityLabel (which the a11y
    // tree hides from a plain text query by design).
    expect(
      screen.queryByText('One tap per day advances your skin cycle and adaptation tracking.'),
    ).toBeNull();
  });
});
