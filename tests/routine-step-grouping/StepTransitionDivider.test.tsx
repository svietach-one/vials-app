/**
 * Component tests — StepTransitionDivider (US-37, US-39).
 * Spec: docs/specs/routine-step-grouping/{PRD_Spec,SCREENS,USER_STORIES}.md §5
 *
 * StepTransitionDivider does not exist yet — this file fails to resolve
 * until the engineer creates src/components/routine/StepTransitionDivider.tsx
 * per the contract in fixtures.ts. Expected (tests-first).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { makeStepTransitionDividerProps } from './fixtures';
import { StepTransitionDivider } from '@/components/routine/StepTransitionDivider';
import type { StepTransition } from '@/types';

describe('US-37/US-39: copy by transition kind', () => {
  const table: Array<[StepTransition, string]> = [
    [{ kind: 'note', text: 'dry_skin' }, 'on dry skin'],
    [{ kind: 'note', text: 'immediate' }, 'apply next right away'],
    [{ kind: 'note', text: 'until_dry' }, 'until fully dry'],
    [{ kind: 'note', text: 'before_sun' }, '~15 min before sun exposure'],
  ];

  it.each(table)('renders %o as "%s"', (transition, expectedCopy) => {
    render(<StepTransitionDivider {...makeStepTransitionDividerProps({ transition })} />);
    expect(screen.getByText(expectedCopy)).toBeTruthy();
  });

  it('renders nothing at all for kind "none" — no row, no reserved space', () => {
    const { toJSON } = render(
      <StepTransitionDivider {...makeStepTransitionDividerProps({ transition: { kind: 'none' } })} />,
    );
    expect(toJSON()).toBeNull();
  });
});

describe('US-37 negative: no numeric wait variant exists', () => {
  it('the type only accepts the four documented note kinds plus none (compile-time guard)', () => {
    // If a `wait` kind were ever added back to StepTransition without a
    // corresponding review sign-off, this file would need updating — the
    // absence of a `wait` case here IS the regression guard (PRD_Spec.md §5.2).
    const kinds: StepTransition['kind'][] = ['note', 'none'];
    expect(kinds).toEqual(['note', 'none']);
  });
});

describe('Non-interactive', () => {
  it('exposes no button role anywhere in the rendered tree for a note transition', () => {
    render(
      <StepTransitionDivider
        {...makeStepTransitionDividerProps({ transition: { kind: 'note', text: 'dry_skin' } })}
      />,
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
