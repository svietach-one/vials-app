/**
 * Screen integration — CalibrationCard on ProcedureDetailScreen (spec Story 4).
 * Real stores, storage mocked, Alert.alert spied.
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeCustomProcedureLog, makeProcedureLog, makeProfile, TID, textOf, toRegExp } from './fixtures';

jest.mock('@/services/storage', () => ({
  ...jest.requireActual('@/services/storage'),
  loadJson: jest.fn(async (_k: string, fallback: unknown) => fallback),
  saveJson: jest.fn(async () => undefined),
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <View testID={`feather-icon-${name}`} /> };
});

import ProcedureDetailScreen from '@/screens/ProcedureDetailScreen';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProfileStore } from '@/store/profileStore';

let alertSpy: jest.SpyInstance;

function seed(procs: ReturnType<typeof makeProcedureLog>[], individual = {}) {
  useProfileStore.setState({ profile: makeProfile(individual), hydrated: true });
  useProceduresStore.setState({ procedures: procs, hydrated: true });
}

function renderScreen(procedureId: string) {
  return render(
    <ProcedureDetailScreen
      navigation={{ goBack: jest.fn(), navigate: jest.fn() } as any}
      route={{ params: { procedureId } } as any}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => alertSpy.mockRestore());

describe('card visibility', () => {
  it('shows the empty-state card for a non-custom procedure with no calibration', () => {
    seed([makeProcedureLog()]);
    renderScreen('proc-botox-1');

    expect(screen.getByTestId(TID.card)).toBeTruthy();
    expect(screen.getByTestId(TID.emptyAlert)).toBeTruthy();
    expect(screen.queryByTestId(TID.reset)).toBeNull();
  });

  it('shows default vs estimate for a calibrated key', () => {
    seed([makeProcedureLog()], { botox: { months: 5, samples: 2 } });
    renderScreen('proc-botox-1');

    expect(textOf(screen.getByTestId(TID.estimateValue))).toMatch(toRegExp('5.0 months'));
    expect(textOf(screen.getByTestId(TID.reportsTag))).toMatch(toRegExp('2 reports'));
  });

  it('still shows the card for an archived procedure', () => {
    seed([makeProcedureLog({ status: 'archived', realDuration: 4 })], { botox: { months: 5, samples: 1 } });
    renderScreen('proc-botox-1');

    expect(screen.getByTestId(TID.card)).toBeTruthy();
  });

  it('renders no card for a custom procedure', () => {
    seed([makeCustomProcedureLog()], { botox: { months: 5, samples: 1 } });
    renderScreen('proc-custom-1');

    expect(screen.queryByTestId(TID.card)).toBeNull();
  });
});

describe('Reset to default', () => {
  it('removes the key but keeps archived realDuration and existing logs', () => {
    const archived = makeProcedureLog({ id: 'old', status: 'archived', realDuration: 4, expectedMonths: 5 });
    seed([makeProcedureLog(), archived], { botox: { months: 5, samples: 2 } });
    renderScreen('proc-botox-1');

    fireEvent.press(screen.getByTestId(TID.reset));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Reset')?.onPress?.();

    expect(useProfileStore.getState().profile?.individualDurationMonths).toEqual({});
    expect(useProceduresStore.getState().procedures.find((p) => p.id === 'old')).toEqual(archived);
    expect(screen.getByTestId(TID.emptyAlert)).toBeTruthy();
  });

  it('keeps the calibration when the alert is cancelled', () => {
    seed([makeProcedureLog()], { botox: { months: 5, samples: 2 } });
    renderScreen('proc-botox-1');

    fireEvent.press(screen.getByTestId(TID.reset));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Cancel')?.onPress?.();

    expect(useProfileStore.getState().profile?.individualDurationMonths).toEqual({
      botox: { months: 5, samples: 2 },
    });
  });
});
