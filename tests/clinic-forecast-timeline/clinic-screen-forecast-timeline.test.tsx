/**
 * Screen-level integration tests — ClinicScreen wiring for the forecast
 * timeline (clinic-forecast-timeline).
 *
 * Spec:        docs/specs/clinic-forecast-timeline.md
 * Tech design: docs/tech-design/clinic-forecast-timeline.md (FE-3)
 *
 * `ForecastTimeline` itself is mocked at the module boundary here (its own
 * behaviour — window math, segments, row stacking — is covered by
 * forecast-timeline.test.tsx). This suite only asserts ClinicScreen's own
 * responsibilities per the tech design:
 *   - filters archived procedures before handing them to the ribbon and
 *     gates the ribbon's presence on the non-archived subset (Story 4)
 *   - wires tap -> FlatList.scrollToItem with the matching procedure log,
 *     without navigating away (Story 3)
 *
 * `react-native`'s `FlatList` is partially mocked: the real module is loaded
 * via `jest.requireActual` and every other export (View, Text, Pressable,
 * Modal, ScrollView, StyleSheet, ...) stays real and untouched — only
 * `FlatList` is swapped, via a `Proxy` `get` trap rather than an object
 * spread. A `{ ...jest.requireActual('react-native') }` spread was tried
 * first (per the coordinator's stated preference) but eagerly enumerates
 * every export getter on the real RN module, including `DevMenu`, which
 * throws `TurboModuleRegistry.getEnforcing(...): 'DevMenu' could not be
 * found` outside a native runtime. The `Proxy` only evaluates a getter the
 * moment consuming code actually reads that specific export, so unrelated
 * FlatList behaviour stays exactly as real as a spread would give it,
 * without forcing every lazy RN export to resolve up front.
 *
 * These tests exercise the CURRENT (pre-engineer) ClinicScreen.tsx, which
 * does not yet import ForecastTimeline, gate on visibleProcedures, or hold a
 * FlatList ref. They are expected to FAIL against today's implementation —
 * that is the point of tests-first. See progress/clinic-forecast-timeline.md.
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

const mockScrollToItem = jest.fn();

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const ReactActual = require('react');

  const MockFlatList = ReactActual.forwardRef(function MockFlatList(props: any, ref: any) {
    const { data, renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent, ItemSeparatorComponent } = props;

    ReactActual.useImperativeHandle(ref, () => ({
      scrollToItem: mockScrollToItem,
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

// ── ForecastTimeline mock — captures props, exposes tappable stand-ins ────────

// Pre-implementation this mock needed `{ virtual: true }` + a relative path
// (see progress/clinic-forecast-timeline.md, qa-lead entry). Now that
// src/components/clinic/ForecastTimeline.tsx exists, the virtual workaround
// is not just unnecessary but broken: a virtual mock registers under the
// unresolved, extensionless path, while jest resolves the real import to the
// .tsx file's module ID, so the real component loaded and the mock was never
// consulted. A plain (non-virtual) mock on the alias registers under the
// resolved module ID and intercepts ClinicScreen's import correctly.
// [engineer 2026-07-06 — mock plumbing only, assertions untouched]
jest.mock('@/components/clinic/ForecastTimeline', () => {
  const { View, Pressable } = require('react-native');
  return {
    ForecastTimeline: ({ procedures, onSelectProcedure }: any) => (
      <View testID="mock-forecast-timeline-root">
        {procedures.map((p: UserProcedureLog) => (
          <Pressable
            key={p.id}
            testID={`mock-forecast-track-${p.id}`}
            accessibilityRole="button"
            onPress={() => onSelectProcedure(p.id)}
          />
        ))}
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

// ── Story 4: ribbon presence gated on non-archived procedures ────────────────

describe('Story 4: ribbon presence is gated on non-archived procedures', () => {
  it('omits the ribbon when there are zero logged procedures', () => {
    mockProcedures = [];
    renderScreen();

    expect(screen.queryByTestId('mock-forecast-timeline-root')).toBeNull();
  });

  it('omits the ribbon when every logged procedure is archived', () => {
    mockProcedures = [ARCHIVED_PROC, makeProcedureLog({ id: 'archived-2', status: 'archived' })];
    renderScreen();

    expect(screen.queryByTestId('mock-forecast-timeline-root')).toBeNull();
  });

  it('still shows the FlatList cards for archived procedures even though the ribbon is omitted', () => {
    mockProcedures = [ARCHIVED_PROC];
    renderScreen();

    expect(screen.queryByTestId('mock-forecast-timeline-root')).toBeNull();
    expect(screen.getByTestId(`procedure-card-${ARCHIVED_PROC.id}`)).toBeTruthy();
  });

  it('renders the ribbon with only the non-archived subset when the list is mixed', () => {
    mockProcedures = [ARCHIVED_PROC, BOTOX_ACTIVE];
    renderScreen();

    expect(screen.getByTestId('mock-forecast-timeline-root')).toBeTruthy();
    expect(screen.getByTestId(`mock-forecast-track-${BOTOX_ACTIVE.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`mock-forecast-track-${ARCHIVED_PROC.id}`)).toBeNull();
  });
});

// ── Story 3: tap a track -> scroll the FlatList to that card ─────────────────

describe('Story 3: tapping a track scrolls the FlatList to the matching card', () => {
  it('calls FlatList.scrollToItem with the tapped procedure log', () => {
    mockProcedures = [BOTOX_ACTIVE];
    renderScreen();

    fireEvent.press(screen.getByTestId(`mock-forecast-track-${BOTOX_ACTIVE.id}`));

    expect(mockScrollToItem).toHaveBeenCalledTimes(1);
    const call = mockScrollToItem.mock.calls[0][0];
    expect(call.item.id).toBe(BOTOX_ACTIVE.id);
    expect(call.animated).toBe(true);
  });

  it('does not navigate away from the Clinic screen when a track is tapped', () => {
    mockProcedures = [BOTOX_ACTIVE];
    const navigate = jest.fn();
    renderScreen(navigate);

    fireEvent.press(screen.getByTestId(`mock-forecast-track-${BOTOX_ACTIVE.id}`));

    expect(navigate).not.toHaveBeenCalled();
  });
});
