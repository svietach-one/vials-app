/**
 * Regression - ProcedureLifespanCard time labels must not print raw floats.
 * Calibration (expectedMonths) makes the fade point and total fractional, e.g.
 * Botox expectedMonths 5 -> fadeTriggerMonth 3.3333333333333335.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { makeProcedureLog } from './fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <View testID={`feather-icon-${name}`} /> };
});

import { ProcedureLifespanCard } from '@/components/clinic/ProcedureLifespanCard';
import type { UserProcedureLog } from '@/types';

const NOW = new Date('2026-06-01T12:00:00Z');

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => jest.useRealTimers());

function renderCard(proc: UserProcedureLog) {
  return render(
    <ProcedureLifespanCard proc={proc} onUpdate={jest.fn()} onReportDuration={jest.fn()} onOpenMenu={jest.fn()} />,
  );
}

describe('active label', () => {
  it('shows the fade point with one decimal when expectedMonths makes it fractional', () => {
    renderCard(makeProcedureLog({ datePerformed: '2026-05-10', expectedMonths: 5 }));

    expect(screen.getByText(/^Month 1 of 3\.3 · fading check in ~\d+ months?$/)).toBeTruthy();
  });

  it('keeps an integer fade point unchanged without expectedMonths', () => {
    renderCard(makeProcedureLog({ datePerformed: '2026-05-10' }));

    expect(screen.getByText(/^Month 1 of 4 · fading check in ~\d+ months?$/)).toBeTruthy();
  });

  it('never prints a long float for a two-decimal calibrated estimate', () => {
    renderCard(makeProcedureLog({ datePerformed: '2026-05-10', expectedMonths: 3.33 }));

    expect(screen.getByText(/^Month 1 of 2\.2 · /)).toBeTruthy();
  });
});

describe('completed label', () => {
  it('rounds the cycle length to one decimal', () => {
    renderCard(makeProcedureLog({ datePerformed: '2026-01-01', expectedMonths: 4.37 }));

    expect(screen.getByText('Full 4.4-month cycle complete')).toBeTruthy();
  });

  it('keeps an integer cycle length unchanged', () => {
    renderCard(makeProcedureLog({ datePerformed: '2025-10-01' }));

    expect(screen.getByText('Full 6-month cycle complete')).toBeTruthy();
  });
});

describe('history label', () => {
  it('rounds the recorded duration to one decimal', () => {
    renderCard(makeProcedureLog({ status: 'archived', realDuration: 4.37 }));

    expect(screen.getByText('Lasted ~4.4 months (your record)')).toBeTruthy();
  });

  it('keeps an integer recorded duration unchanged', () => {
    renderCard(makeProcedureLog({ status: 'archived', realDuration: 4 }));

    expect(screen.getByText('Lasted ~4 months (your record)')).toBeTruthy();
  });
});
