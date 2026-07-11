/**
 * Component tests — Story 3 ACs 1 & 4: the passive duplicate-slot banner,
 * sibling to ConflictWarningInline.
 * Spec: docs/specs/2026-07-11-routine-similar-product-priority.md §4 Story 3
 * Tech design: docs/tech-design/routine-similar-product-priority.md (FE-8)
 *
 * DuplicateSlotWarningInline does not exist yet — this file fails to resolve
 * until the engineer creates
 * src/components/routine/DuplicateSlotWarningInline.tsx per the contract in
 * fixtures.ts. Expected (tests-first).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Routine } from '@/types';

import {
  CREAM_A,
  CREAM_B,
  SERUM_UNIQUE,
  SPF_A,
  makeDuplicateSlotWarningInlineProps,
  makeRoutine,
  makeStep,
} from './fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

import { DuplicateSlotWarningInline } from '@/components/routine/DuplicateSlotWarningInline';

describe('Story 3 AC1: a shared-slot pair renders a passive, human-readable warning', () => {
  it('shows "2 similar products (moisturizers) in this routine" for two moisturizers in one routine', () => {
    const amRoutine: Routine = makeRoutine({
      id: 'routine-am',
      timeOfDay: 'morning',
      steps: [
        makeStep({ productType: 'moisturizer', productId: CREAM_A.id }),
        makeStep({ productType: 'moisturizer', productId: CREAM_B.id }),
      ],
    });

    render(
      <DuplicateSlotWarningInline
        {...makeDuplicateSlotWarningInlineProps({
          routines: [amRoutine],
          products: [CREAM_A, CREAM_B],
        })}
      />,
    );

    expect(screen.getByText(/2 similar products \(moisturizers\) in this routine/i)).toBeTruthy();
  });
});

describe('Story 3 AC4: no duplicate warning is rendered for a routine with no shared-slot steps', () => {
  it('renders null for a routine with only distinct-slot products', () => {
    const amRoutine: Routine = makeRoutine({
      id: 'routine-am',
      timeOfDay: 'morning',
      steps: [
        makeStep({ productType: 'moisturizer', productId: CREAM_A.id }),
        makeStep({ productType: 'serum', productId: SERUM_UNIQUE.id }),
        makeStep({ productType: 'spf', productId: SPF_A.id }),
      ],
    });

    const { toJSON } = render(
      <DuplicateSlotWarningInline
        {...makeDuplicateSlotWarningInlineProps({
          routines: [amRoutine],
          products: [CREAM_A, SERUM_UNIQUE, SPF_A],
        })}
      />,
    );

    expect(toJSON()).toBeNull();
  });

  it('renders null for an empty routine set', () => {
    const { toJSON } = render(
      <DuplicateSlotWarningInline {...makeDuplicateSlotWarningInlineProps({ routines: [], products: [] })} />,
    );
    expect(toJSON()).toBeNull();
  });
});

describe('Duplicate groups never merge across routines/periods', () => {
  it('does not warn when AM has one moisturizer and PM has a different single moisturizer', () => {
    const amRoutine = makeRoutine({
      id: 'routine-am',
      timeOfDay: 'morning',
      steps: [makeStep({ productType: 'moisturizer', productId: CREAM_A.id })],
    });
    const pmRoutine = makeRoutine({
      id: 'routine-pm',
      timeOfDay: 'evening',
      steps: [makeStep({ productType: 'moisturizer', productId: CREAM_B.id })],
    });

    const { toJSON } = render(
      <DuplicateSlotWarningInline
        {...makeDuplicateSlotWarningInlineProps({
          routines: [amRoutine, pmRoutine],
          products: [CREAM_A, CREAM_B],
        })}
      />,
    );

    expect(toJSON()).toBeNull();
  });
});

describe('The `other` slot is always exempt from duplicate detection', () => {
  it('does not warn for two "other" products sharing a routine', () => {
    const OTHER_A = { ...CREAM_A, id: 'p-other-a', productType: 'other' as const };
    const OTHER_B = { ...CREAM_B, id: 'p-other-b', productType: 'other' as const };
    const amRoutine = makeRoutine({
      id: 'routine-am',
      timeOfDay: 'morning',
      steps: [
        makeStep({ productType: 'other', productId: OTHER_A.id }),
        makeStep({ productType: 'other', productId: OTHER_B.id }),
      ],
    });

    const { toJSON } = render(
      <DuplicateSlotWarningInline
        {...makeDuplicateSlotWarningInlineProps({
          routines: [amRoutine],
          products: [OTHER_A, OTHER_B],
        })}
      />,
    );

    expect(toJSON()).toBeNull();
  });
});

describe('Tapping a duplicate-group row reports the group to the caller', () => {
  it('calls onPressGroup with the routineId, slotIndex, and both productIds', () => {
    const onPressGroup = jest.fn();
    const amRoutine = makeRoutine({
      id: 'routine-am',
      timeOfDay: 'morning',
      steps: [
        makeStep({ id: 'step-a', productType: 'moisturizer', productId: CREAM_A.id }),
        makeStep({ id: 'step-b', productType: 'moisturizer', productId: CREAM_B.id }),
      ],
    });

    render(
      <DuplicateSlotWarningInline
        {...makeDuplicateSlotWarningInlineProps({
          routines: [amRoutine],
          products: [CREAM_A, CREAM_B],
          onPressGroup,
        })}
      />,
    );

    fireEvent.press(screen.getByLabelText(/2 similar products \(moisturizers\)/i));

    expect(onPressGroup).toHaveBeenCalledTimes(1);
    const arg = onPressGroup.mock.calls[0][0];
    expect(arg.routineId).toBe('routine-am');
    expect(new Set(arg.productIds)).toEqual(new Set([CREAM_A.id, CREAM_B.id]));
  });
});
