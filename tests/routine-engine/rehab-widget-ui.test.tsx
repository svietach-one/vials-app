/**
 * Integration tests — Story 10 UI ACs: the merged rehab notice card, and the
 * "long-term effect only shows on the Clinic timeline, never the daily
 * Routines card" rule.
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 10
 *
 * FE-10 shipped the rehab shield (progress/routine-engine.md, 2026-07-05
 * "REHAB SHIELD WIDGET" entry). The shield + the separate lifestyle-
 * restrictions card were later merged into one RehabNoticeCard per procedure
 * (two cards about one procedure read as needlessly anxious). This file covers
 * the presentational card plus the cross-screen contrast with the Clinic
 * timeline card (ProcedureLifespanCard), which renders long-term-only
 * procedures that the daily rehab notice deliberately does not.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { RehabNotice, UserProcedureLog } from '@/types';
import { buildRehabNotices } from '@/utils/routineEngine/rehabFilter';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

import { RehabNoticeCard } from '@/components/routine/RehabNoticeCard';
import { ProcedureLifespanCard } from '@/components/clinic/ProcedureLifespanCard';

function makeNotice(overrides: Partial<RehabNotice> = {}): RehabNotice {
  return {
    key: 'proc-1',
    procedureName: 'Deep Chemical Peel',
    currentDay: 5,
    totalDays: 14,
    barrierStatus: 'disrupted',
    restrictions: [],
    ...overrides,
  };
}

describe('Story 10 AC: RehabNoticeCard renders the merged rehab notice', () => {
  it('shows "Rehabilitation: [Name]" and "Day X of Y"', () => {
    render(<RehabNoticeCard notice={makeNotice()} />);

    expect(screen.getByText(/Rehabilitation: Deep Chemical Peel/)).toBeTruthy();
    expect(screen.getByText('Day 5 of 14')).toBeTruthy();
  });

  it('renders the acute restriction lines inside the same card when present', () => {
    render(
      <RehabNoticeCard
        notice={makeNotice({
          procedureName: 'Botox / Dysport',
          restrictions: ['No sauna or hot baths', 'Stay upright for 4 hours'],
        })}
      />,
    );

    expect(screen.getByText('No sauna or hot baths')).toBeTruthy();
    expect(screen.getByText('Stay upright for 4 hours')).toBeTruthy();
  });

  it('renders no restriction lines once the notice reports none (past the acute phase)', () => {
    render(<RehabNoticeCard notice={makeNotice({ barrierStatus: 'sensitive', restrictions: [] })} />);

    expect(screen.queryByText('No sauna or hot baths')).toBeNull();
    // The card itself still stands while the barrier recovers.
    expect(screen.getByText(/Rehabilitation: Deep Chemical Peel/)).toBeTruthy();
  });
});

describe('Story 10 AC: a long-term-only effect (Botox month 2) never renders the daily rehab card, only the Clinic timeline card', () => {
  it('buildRehabNotices emits nothing while ProcedureLifespanCard still renders the procedure', () => {
    const procDate = new Date();
    procDate.setDate(procDate.getDate() - 60); // well past the 7-day Botox rehab window
    const botoxMonth2: UserProcedureLog = {
      id: 'proc-botox',
      procedureKey: 'botox',
      datePerformed: procDate.toISOString().split('T')[0],
      status: 'active',
      deferralCount: 0,
    };

    // No daily-screen rehab card for the still-active long-term effect.
    expect(buildRehabNotices([botoxMonth2], new Date())).toEqual([]);

    // The Clinic timeline card renders it regardless (its home, per Rule B).
    render(<ProcedureLifespanCard proc={botoxMonth2} onUpdate={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText('Botox / Dysport')).toBeTruthy();
  });
});
