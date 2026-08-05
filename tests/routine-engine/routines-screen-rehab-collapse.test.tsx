/**
 * Integration test — RehabNoticeCard's per-day collapse persistence, wired
 * through the real RoutinesScreen and the real settingsStore (not mocked, so
 * a missing `listHeader` useMemo dependency would actually be caught here —
 * that exact bug shipped once already: the header's useMemo recomputed on
 * mount, but taps after that used a stale `collapsed`/`onToggleCollapse`
 * closure since `rehabNoticeCollapsed` wasn't in its dependency array, so a
 * card could be tapped closed but never re-opened by hand). Mocking follows
 * the same boundary playbook as
 * tests/routine-engine/routines-screen-paused-rows.test.tsx, except
 * settingsStore is real (reset per test) and RehabNoticeCard is NOT mocked
 * away, since the wiring itself is the subject here.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine, UserProcedureLog } from '@/types';

jest.mock('@react-navigation/native', () => {
  const ReactActual = require('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactActual.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
  };
});

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

jest.mock('react-native-draggable-flatlist', () => {
  const { View } = require('react-native');
  function DraggableFlatList({ data, renderItem, keyExtractor, ListEmptyComponent, ListHeaderComponent, ListFooterComponent }: any) {
    return (
      <View testID="draggable-flat-list">
        {ListHeaderComponent}
        {data.length === 0
          ? ListEmptyComponent
          : data.map((item: any, index: number) => (
              <View key={keyExtractor ? keyExtractor(item, index) : index}>
                {renderItem({ item, drag: () => {}, isActive: false, getIndex: () => index })}
              </View>
            ))}
        {ListFooterComponent}
      </View>
    );
  }
  const ScaleDecorator = ({ children }: any) => children;
  const NestableScrollContainer = ({ children }: any) => <View>{children}</View>;
  const NestableDraggableFlatList = ({ data, renderItem, keyExtractor }: any) => (
    <View>
      {data.map((item: any, index: number) => (
        <View key={keyExtractor ? keyExtractor(item, index) : index}>
          {renderItem({ item, drag: () => {}, isActive: false, getIndex: () => index })}
        </View>
      ))}
    </View>
  );
  return { __esModule: true, default: DraggableFlatList, ScaleDecorator, NestableScrollContainer, NestableDraggableFlatList };
});

jest.mock('@/components/routine/AddToRoutineSheet', () => ({ AddToRoutineSheet: () => null }));
jest.mock('@/components/routine/DraftPreviewScreen', () => ({ DraftPreviewScreen: () => null }));
jest.mock('@/components/routine/RemoveStepModal', () => ({ RemoveStepModal: () => null }));
jest.mock('@/components/routine/SeasonalNoticeBanner', () => ({ SeasonalNoticeBanner: () => null }));

jest.mock('@/components/routine/PlannerBlock', () => {
  const { Pressable } = require('react-native');
  return {
    PlannerBlock: ({ onPeriodChange }: any) => (
      <Pressable testID="switch-to-evening" onPress={() => onPeriodChange('evening')} />
    ),
  };
});

jest.mock('@/components/routine/RoutineStepCard', () => {
  const { Pressable, Text } = require('react-native');
  return {
    RoutineStepCard: ({ product, onCardPress }: any) => (
      <Pressable onPress={onCardPress} accessibilityRole="button" accessibilityLabel={product.name}>
        <Text>{product.name}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/domain/routinePlanActions', () => ({
  validateCurrentRoutines: jest.fn(() => ({
    findings: [],
    hasBlockingFindings: false,
    proposedPlan: {
      rulesetVersion: 'test',
      generatedFor: '2026-01-01',
      periods: { morning: [], evening: [] },
      frozen: [],
      placeholders: [],
      decisions: [],
    },
    diff: [],
  })),
  applyRoutinePlan: jest.fn(),
}));

jest.mock('@/domain/seasonActions', () => ({
  getActiveSeasonMask: jest.fn(() => ({ season: 'spring', source: 'calendar' })),
}));

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: null })),
}));

let mockApplicationStats: unknown[] = [];
jest.mock('@/store/trackingStore', () => ({
  useTrackingStore: jest.fn((selector: any) => selector({ applicationStats: mockApplicationStats })),
}));

let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];
let mockProcedures: UserProcedureLog[] = [];

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({ routines: mockRoutines, reorderSteps: jest.fn(), removeStepFromDay: jest.fn(), removeProductStep: jest.fn() }),
  ),
}));

jest.mock('@/store/proceduresStore', () => ({
  useProceduresStore: jest.fn((selector: any) => selector({ procedures: mockProcedures })),
}));

// settingsStore is intentionally NOT mocked — the real store is what makes
// this test able to catch a missing useMemo dependency.
import { useSettingsStore } from '@/store/settingsStore';
import RoutinesScreen from '@/screens/RoutinesScreen';

function renderScreen() {
  return render(
    <RoutinesScreen navigation={{ navigate: jest.fn(), setOptions: jest.fn() } as any} route={{} as any} />,
  );
}

beforeEach(() => {
  mockApplicationStats = [];
  mockProducts = [];
  mockRoutines = [
    { id: 'routine-am', name: 'Morning', timeOfDay: 'morning', steps: [] },
    { id: 'routine-pm', name: 'Evening', timeOfDay: 'evening', steps: [] },
  ];
  // A "Trauma / Laser" custom preset (7 days), logged today — well inside its
  // rehab window, so buildRehabNotices always emits exactly one card.
  mockProcedures = [
    {
      id: 'proc-1',
      procedureKey: 'custom',
      customName: 'Laser resurfacing',
      customRehabDays: 7,
      datePerformed: new Date().toISOString().split('T')[0],
      status: 'rehab',
      deferralCount: 0,
    },
  ];
  useSettingsStore.setState({ rehabNoticeCollapsed: {} });
});

describe('RehabNoticeCard collapse — wired through the real RoutinesScreen + settingsStore', () => {
  it('renders expanded on first visit, with the body text visible', () => {
    renderScreen();

    expect(screen.getByText(/Rehabilitation: Laser resurfacing/)).toBeTruthy();
    expect(screen.getByText(/Skin barrier disrupted/)).toBeTruthy();
  });

  it('collapses on tap, hiding the body text but keeping the header and day count', () => {
    renderScreen();

    fireEvent.press(screen.getByText(/Rehabilitation: Laser resurfacing/));

    expect(screen.getByText(/Rehabilitation: Laser resurfacing/)).toBeTruthy();
    expect(screen.queryByText(/Skin barrier disrupted/)).toBeNull();
  });

  it('re-expands on a second tap — regression guard for the stale-closure bug', () => {
    renderScreen();

    fireEvent.press(screen.getByText(/Rehabilitation: Laser resurfacing/));
    expect(screen.queryByText(/Skin barrier disrupted/)).toBeNull();

    fireEvent.press(screen.getByText(/Rehabilitation: Laser resurfacing/));
    expect(screen.getByText(/Skin barrier disrupted/)).toBeTruthy();
  });

  it('persists a collapse into settingsStore, tagged with today\'s skincare date', () => {
    renderScreen();

    fireEvent.press(screen.getByText(/Rehabilitation: Laser resurfacing/));

    const entry = useSettingsStore.getState().rehabNoticeCollapsed['proc-1'];
    expect(entry.collapsed).toBe(true);
    expect(typeof entry.date).toBe('string');
  });
});
