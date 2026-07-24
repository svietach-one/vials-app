/**
 * Screen-level integration tests — ClinicScreen tab wiring.
 *
 * The 12-month forecast ribbon was removed from ClinicScreen during the Clinic
 * redesign (the calendar strip is gone); the screen now splits procedures into
 * an Active / History segmented control. `ForecastTimeline` still exists and is
 * covered in isolation by forecast-timeline.test.tsx — it is simply no longer
 * mounted here. This suite asserts ClinicScreen's current responsibilities:
 *   - the Active tab (default) lists only non-archived procedures
 *   - the History tab lists only archived procedures
 *   - each tab shows its own empty state when its subset is empty
 *
 * `react-native`'s `FlatList` is partially mocked: the real module is loaded
 * via `jest.requireActual` and every other export stays real, only `FlatList`
 * is swapped via a `Proxy` `get` trap (a full spread eagerly resolves lazy RN
 * exports like `DevMenu`, which throws outside a native runtime).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { UserProcedureLog } from '@/types';
import {
  BOTOX_ACTIVE,
  ARCHIVED_PROC,
  makeProcedureLog,
} from './fixtures';

// ── react-native FlatList — partial mock, everything else stays real ─────────

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const ReactActual = require('react');

  const MockFlatList = ReactActual.forwardRef(function MockFlatList(props: any, ref: any) {
    const { data, renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent, ItemSeparatorComponent } = props;

    ReactActual.useImperativeHandle(ref, () => ({
      scrollToItem: jest.fn(),
      scrollToIndex: jest.fn(),
      scrollToOffset: jest.fn(),
    }));

    const header =
      typeof ListHeaderComponent === 'function' ? ReactActual.createElement(ListHeaderComponent) : ListHeaderComponent;

    return (
      <RN.View testID="clinic-flat-list">
        {header}
        {data.length === 0
          ? ListEmptyComponent
          : data.map((item: any, index: number) => (
              <RN.View key={keyExtractor ? keyExtractor(item, index) : index}>
                {index > 0 && ItemSeparatorComponent ? <ItemSeparatorComponent /> : null}
                {renderItem({ item, index })}
              </RN.View>
            ))}
      </RN.View>
    );
  });

  return new Proxy(RN, {
    get(target, prop, receiver) {
      if (prop === 'FlatList') return MockFlatList;
      return Reflect.get(target, prop, receiver);
    },
  });
});

// ── Icon mock (precedent pattern) ─────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

// ── Heavy / irrelevant child components ───────────────────────────────────────

jest.mock('@/components/clinic/AddProcedureModal', () => ({
  AddProcedureModal: () => null,
}));

jest.mock('@/components/product/DeleteProductModal', () => ({
  DeleteProductModal: () => null,
}));

jest.mock('@/components/clinic/ProcedureLifespanCard', () => {
  const { View, Text } = require('react-native');
  return {
    ProcedureLifespanCard: ({ proc }: { proc: UserProcedureLog }) => (
      <View testID={`procedure-card-${proc.id}`}>
        <Text>{proc.id}</Text>
      </View>
    ),
  };
});

// ── Store mock ────────────────────────────────────────────────────────────────

let mockProcedures: UserProcedureLog[] = [];
const mockAddProcedure = jest.fn();
const mockUpdateProcedure = jest.fn();
const mockRemoveProcedure = jest.fn();

jest.mock('@/store/proceduresStore', () => ({
  useProceduresStore: jest.fn((selector: any) =>
    selector({
      procedures: mockProcedures,
      addProcedure: mockAddProcedure,
      updateProcedure: mockUpdateProcedure,
      removeProcedure: mockRemoveProcedure,
    }),
  ),
}));

// ── Subject under test ────────────────────────────────────────────────────────

import ClinicScreen from '@/screens/ClinicScreen';

function renderScreen(navigate = jest.fn()) {
  return render(
    <ClinicScreen navigation={{ navigate, setOptions: jest.fn() } as any} route={{} as any} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProcedures = [];
});

// ── Active tab: ongoing procedures only ──────────────────────────────────────

describe('Active tab lists only non-archived procedures', () => {
  it('shows non-archived cards and hides archived ones on the default tab', () => {
    mockProcedures = [ARCHIVED_PROC, BOTOX_ACTIVE];
    renderScreen();

    expect(screen.getByTestId(`procedure-card-${BOTOX_ACTIVE.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`procedure-card-${ARCHIVED_PROC.id}`)).toBeNull();
  });

  it('renders the empty state when no procedures are logged', () => {
    mockProcedures = [];
    renderScreen();

    expect(screen.getByText('No procedures logged')).toBeTruthy();
  });
});

// ── History tab: archived procedures only ────────────────────────────────────

describe('History tab lists only archived procedures', () => {
  it('shows archived cards and hides active ones after switching to History', () => {
    mockProcedures = [ARCHIVED_PROC, BOTOX_ACTIVE];
    renderScreen();

    fireEvent.press(screen.getByText('History'));

    expect(screen.getByTestId(`procedure-card-${ARCHIVED_PROC.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`procedure-card-${BOTOX_ACTIVE.id}`)).toBeNull();
  });

  it('renders the archived empty state when nothing is archived', () => {
    mockProcedures = [BOTOX_ACTIVE];
    renderScreen();

    fireEvent.press(screen.getByText('History'));

    expect(screen.getByText('Nothing archived yet')).toBeTruthy();
    expect(screen.queryByTestId(`procedure-card-${BOTOX_ACTIVE.id}`)).toBeNull();
  });
});
