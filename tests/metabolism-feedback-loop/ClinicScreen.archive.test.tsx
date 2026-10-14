/**
 * Screen integration — ClinicScreen "Move to history" feedback flow and
 * logProcedure wiring (spec Stories 1 and 3). Real stores, storage mocked.
 * Heavy children (card, action sheet, add modal) are replaced by thin
 * stand-ins that only expose the callbacks ClinicScreen wires.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  makeCustomProcedureLog,
  makeProcedureLog,
  makeProfile,
  makeRehabProcedureLog,
  OPTION,
  TID,
} from './fixtures';

jest.mock('@/services/storage', () => ({
  ...jest.requireActual('@/services/storage'),
  loadJson: jest.fn(async (_k: string, fallback: unknown) => fallback),
  saveJson: jest.fn(async () => undefined),
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <View testID={`feather-icon-${name}`} /> };
});

jest.mock('@/components/product/DeleteProductModal', () => ({ DeleteProductModal: () => null }));

jest.mock('@/components/clinic/ProcedureLifespanCard', () => {
  const { Pressable, Text } = require('react-native');
  return {
    ProcedureLifespanCard: ({ proc, onOpenMenu }: any) => (
      <Pressable testID={`open-menu-${proc.id}`} onPress={onOpenMenu}>
        <Text>{proc.id}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/components/clinic/ProcedureActionSheet', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    ProcedureActionSheet: ({ proc, onMoveToHistory, onClose }: any) =>
      proc ? (
        <View>
          <Pressable
            testID="sheet-move-to-history"
            onPress={() => {
              onMoveToHistory(proc);
              onClose();
            }}
          >
            <Text>Move to history</Text>
          </Pressable>
        </View>
      ) : null,
  };
});

let mockSavedLog: any;
jest.mock('@/components/clinic/AddProcedureModal', () => {
  const { Pressable, Text } = require('react-native');
  return {
    AddProcedureModal: ({ visible, onSave }: any) =>
      visible ? (
        <Pressable testID="add-modal-save" onPress={() => onSave(mockSavedLog)}>
          <Text>Save procedure</Text>
        </Pressable>
      ) : null,
  };
});

import ClinicScreen from '@/screens/ClinicScreen';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProfileStore } from '@/store/profileStore';

const calib = () => useProfileStore.getState().profile?.individualDurationMonths ?? {};
const proc = (id: string) => useProceduresStore.getState().procedures.find((p) => p.id === id);

function seed(procs = [makeProcedureLog()], individual = {}) {
  useProfileStore.setState({ profile: makeProfile(individual), hydrated: true });
  useProceduresStore.setState({ procedures: procs, hydrated: true });
}

function renderScreen() {
  return render(
    <ClinicScreen navigation={{ navigate: jest.fn(), setOptions: jest.fn() } as any} route={{} as any} />,
  );
}

function moveToHistory(id: string) {
  fireEvent.press(screen.getByTestId(`open-menu-${id}`));
  fireEvent.press(screen.getByTestId('sheet-move-to-history'));
}

beforeEach(() => {
  jest.clearAllMocks();
  seed([]);
});

describe('Move to history on a pre-defined procedure', () => {
  it('opens the duration sheet instead of archiving immediately', () => {
    seed();
    renderScreen();

    moveToHistory('proc-botox-1');

    expect(screen.getByTestId(TID.modal)).toBeTruthy();
    expect(proc('proc-botox-1')?.status).toBe('active');
  });

  it('archives without realDuration or toast when Skip is confirmed', () => {
    seed([makeProcedureLog()], { botox: { months: 5, samples: 2 } });
    renderScreen();

    moveToHistory('proc-botox-1');
    fireEvent.press(screen.getByText('Confirm'));

    expect(proc('proc-botox-1')?.status).toBe('archived');
    expect(proc('proc-botox-1')?.realDuration).toBeUndefined();
    expect(calib()).toEqual({ botox: { months: 5, samples: 2 } });
    expect(screen.queryByText('Estimate updated')).toBeNull();
  });

  it('archives, updates the baseline and shows the toast for a valid number', async () => {
    seed();
    renderScreen();

    moveToHistory('proc-botox-1');
    fireEvent.press(screen.getByRole('radio', { name: OPTION.different }));
    fireEvent.changeText(screen.getByTestId(TID.input), '4');
    fireEvent.press(screen.getByText('Confirm'));

    expect(proc('proc-botox-1')).toMatchObject({ status: 'archived', realDuration: 4 });
    expect(calib().botox).toEqual({ months: 5, samples: 1 });
    expect(await screen.findByText('Estimate updated')).toBeTruthy();
  });

  it('writes nothing when the entered value is invalid', () => {
    seed();
    renderScreen();

    moveToHistory('proc-botox-1');
    fireEvent.press(screen.getByRole('radio', { name: OPTION.different }));
    fireEvent.changeText(screen.getByTestId(TID.input), '0');
    fireEvent.press(screen.getByText('Confirm'));

    expect(proc('proc-botox-1')?.status).toBe('active');
    expect(calib()).toEqual({});
  });

  it('changes nothing when Cancel is pressed', () => {
    seed();
    renderScreen();

    moveToHistory('proc-botox-1');
    fireEvent.press(screen.getByText('Cancel'));

    expect(proc('proc-botox-1')).toEqual(makeProcedureLog());
    expect(calib()).toEqual({});
    expect(screen.queryByTestId(TID.modal)).toBeNull();
  });

  it('also shows the sheet for a procedure still in rehab', () => {
    seed([makeRehabProcedureLog()]);
    renderScreen();

    moveToHistory('proc-botox-rehab');

    expect(screen.getByTestId(TID.modal)).toBeTruthy();
  });
});

describe('Move to history on a custom procedure', () => {
  it('archives immediately with no sheet and no calibration', () => {
    seed([makeCustomProcedureLog()]);
    renderScreen();

    moveToHistory('proc-custom-1');

    expect(screen.queryByTestId(TID.modal)).toBeNull();
    expect(proc('proc-custom-1')?.status).toBe('archived');
    expect(calib()).toEqual({});
  });
});

describe('logging a new procedure', () => {
  it('stamps expectedMonths from the calibrated baseline', () => {
    seed([], { botox: { months: 5, samples: 2 } });
    mockSavedLog = makeProcedureLog({ id: 'new-botox' });
    renderScreen();

    fireEvent.press(screen.getAllByRole('button', { name: 'Log procedure' })[0]);
    fireEvent.press(screen.getByTestId('add-modal-save'));

    expect(proc('new-botox')?.expectedMonths).toBe(5);
  });

  it('leaves the log unchanged without calibration', () => {
    seed([]);
    mockSavedLog = makeProcedureLog({ id: 'new-botox' });
    renderScreen();

    fireEvent.press(screen.getAllByRole('button', { name: 'Log procedure' })[0]);
    fireEvent.press(screen.getByTestId('add-modal-save'));

    expect(proc('new-botox')).toEqual(makeProcedureLog({ id: 'new-botox' }));
  });
});
