/**
 * Integration tests — Story 10 UI ACs: the RehabWidget component itself, and
 * the "long-term effect only shows on the Clinic timeline, never the daily
 * Routines widget" rule.
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 10
 *
 * FE-10 shipped RehabWidget.tsx (progress/routine-engine.md, 2026-07-05
 * "REHAB SHIELD WIDGET" entry). buildRehabWidgetState/applyRehabFilter's own
 * engine-level agreement with getDailyView is already covered in
 * tests/routine-engine/rehab-widget.test.ts; this file covers the presentational
 * component plus the cross-screen contrast with the Clinic timeline card
 * (ProcedureLifespanCard), which renders long-term-only procedures that
 * RehabWidget deliberately does not.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { UserProcedureLog } from '@/types';
import { buildRehabWidgetState } from '@/utils/routineEngine/rehabFilter';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

import { RehabWidget } from '@/components/routine/RehabWidget';
import { ProcedureLifespanCard } from '@/components/clinic/ProcedureLifespanCard';

describe('Story 10 AC: RehabWidget renders the persistent rehab shield, top-anchored', () => {
  it('shows "Rehabilitation: [Name]" and "Day X of Y" for an active rehab state', () => {
    render(
      <RehabWidget
        state={{
          procedureName: 'Deep Chemical Peel',
          currentDay: 5,
          totalDays: 14,
          barrierStatus: 'disrupted',
          affectedZones: ['face'],
        }}
      />,
    );

    expect(screen.getByText(/Rehabilitation: Deep Chemical Peel/)).toBeTruthy();
    expect(screen.getByText('Day 5 of 14')).toBeTruthy();
  });

  it('renders nothing when state is null (no active rehab window)', () => {
    const { toJSON } = render(<RehabWidget state={null} />);
    expect(toJSON()).toBeNull();
  });
});

describe('Story 10 AC: a long-term-only effect (Botox month 2) never renders the RehabWidget, only the Clinic timeline card', () => {
  it('buildRehabWidgetState returns null while ProcedureLifespanCard still renders the procedure', () => {
    const procDate = new Date();
    procDate.setDate(procDate.getDate() - 60); // well past the 7-day Botox rehab window
    const botoxMonth2: UserProcedureLog = {
      id: 'proc-botox',
      procedureKey: 'botox',
      datePerformed: procDate.toISOString().split('T')[0],
      status: 'active',
      deferralCount: 0,
    };

    // No daily-screen widget for the still-active long-term effect.
    expect(buildRehabWidgetState([botoxMonth2], new Date())).toBeNull();

    // The Clinic timeline card renders it regardless (its home, per Rule B).
    render(<ProcedureLifespanCard proc={botoxMonth2} onUpdate={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText('Botox / Dysport')).toBeTruthy();
  });
});
