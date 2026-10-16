/**
 * ProcedureLifespanCard prints stored date-only strings (estimatedReturnDate)
 * as the same calendar day the user entered, in any timezone.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { makeCustomProcedureLog } from '../metabolism-feedback-loop/fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <View testID={`feather-icon-${name}`} /> };
});

import { ProcedureLifespanCard } from '@/components/clinic/ProcedureLifespanCard';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 8, 1, 12, 0));
});

afterEach(() => jest.useRealTimers());

describe('ProcedureLifespanCard dates', () => {
  it('shows the estimated return date as the stored calendar day', () => {
    render(
      <ProcedureLifespanCard
        proc={makeCustomProcedureLog({
          datePerformed: '2026-08-01',
          customRehabDays: 0,
          estimatedReturnDate: '2026-10-16',
        })}
        onUpdate={jest.fn()}
        onReportDuration={jest.fn()}
        onOpenMenu={jest.fn()}
      />,
    );

    expect(screen.getByText(/^Est\. return 16 Oct 2026 · /)).toBeTruthy();
  });
});
