/**
 * Component tests — StepGroupHeader (US-34, US-41).
 * Spec: docs/specs/routine-step-grouping/{PRD_Spec,SCREENS,USER_STORIES}.md
 *
 * StepGroupHeader does not exist yet — this file fails to resolve until the
 * engineer creates src/components/routine/StepGroupHeader.tsx per the
 * contract in fixtures.ts. Expected (tests-first).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { makeStepGroupHeaderProps } from './fixtures';
import { StepGroupHeader } from '@/components/routine/StepGroupHeader';

describe('US-34: the header shows an ordinal and the action label', () => {
  it('renders "3. Moisturize" for ordinal 3, action moisturize', () => {
    render(<StepGroupHeader {...makeStepGroupHeaderProps({ ordinal: 3, action: 'moisturize' })} />);
    expect(screen.getByText('3. Moisturize')).toBeTruthy();
  });

  it('renders "1. Cleanse" for ordinal 1, action cleanse', () => {
    render(<StepGroupHeader {...makeStepGroupHeaderProps({ ordinal: 1, action: 'cleanse' })} />);
    expect(screen.getByText('1. Cleanse')).toBeTruthy();
  });

  it('renders every one of the eight action labels as a single imperative-verb word', () => {
    const table: Array<[import('@/types').StepAction, string]> = [
      ['cleanse', 'Cleanse'],
      ['exfoliate', 'Exfoliate'],
      ['tone', 'Tone'],
      ['treat', 'Treat'],
      ['moisturize', 'Moisturize'],
      ['mask', 'Mask'],
      ['seal', 'Seal'],
      ['protect', 'Protect'],
    ];
    for (const [action, label] of table) {
      const { unmount } = render(<StepGroupHeader {...makeStepGroupHeaderProps({ ordinal: 1, action })} />);
      expect(screen.getByText(`1. ${label}`)).toBeTruthy();
      unmount();
    }
  });
});

describe('US-41: a fully-completed step dims its header without a strikethrough', () => {
  it('exposes the dimmed state via an accessibility label suffix when allCompleted is true', () => {
    render(<StepGroupHeader {...makeStepGroupHeaderProps({ ordinal: 2, action: 'treat', allCompleted: true })} />);
    expect(screen.getByLabelText('2. Treat, all done')).toBeTruthy();
    // The visible text itself is never struck through/replaced — the number
    // and label stay legible verbatim.
    expect(screen.getByText('2. Treat')).toBeTruthy();
  });

  it('does not append the dimmed suffix when allCompleted is false', () => {
    render(<StepGroupHeader {...makeStepGroupHeaderProps({ ordinal: 2, action: 'treat', allCompleted: false })} />);
    expect(screen.getByLabelText('2. Treat')).toBeTruthy();
    expect(screen.queryByLabelText('2. Treat, all done')).toBeNull();
  });
});

describe('Edit mode shows a drag affordance', () => {
  it('renders the drag handle when editMode is true', () => {
    render(<StepGroupHeader {...makeStepGroupHeaderProps({ editMode: true })} />);
    expect(screen.getByTestId('step-group-drag-handle')).toBeTruthy();
  });

  it('does not render the drag handle in normal mode', () => {
    render(<StepGroupHeader {...makeStepGroupHeaderProps({ editMode: false })} />);
    expect(screen.queryByTestId('step-group-drag-handle')).toBeNull();
  });
});
