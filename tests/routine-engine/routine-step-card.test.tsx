/**
 * Integration test — Story 6 UI AC: adaptation status line
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 6
 *
 * FE-9 wired `adaptationWeek` into RoutineStepCard (progress/routine-engine.md,
 * 2026-07-05 "SURROUNDING UX" entry). This activates the one remaining Story 6
 * UI it.todo left in tests/routine-engine/cycling-and-adaptation.test.ts.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { Product } from '@/types';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

import { RoutineStepCard } from '@/components/routine/RoutineStepCard';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Retinol Serum',
    brand: 'Vials Lab',
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    activeTags: ['retinoid'],
    fullIngredientText: null,
    usageTime: 'evening',
    openBeautyFactsId: null,
    addedAt: '2026-06-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

describe('Story 6 AC: RoutineStepCard renders the adaptation status line, not a warning banner', () => {
  it('shows "Adaptation Phase (Week 2 of 4)" as an informational status line when adaptationWeek is set', () => {
    render(<RoutineStepCard product={makeProduct()} adaptationWeek={2} />);
    expect(
      screen.getByText(/Adaptation Phase \(Week 2 of 4\)/),
    ).toBeTruthy();
  });

  it('renders no adaptation line at all when adaptationWeek is absent', () => {
    render(<RoutineStepCard product={makeProduct()} />);
    expect(screen.queryByText(/Adaptation Phase/)).toBeNull();
  });

  it('renders no adaptation line when adaptationWeek is explicitly null (product past phase 3)', () => {
    render(<RoutineStepCard product={makeProduct()} adaptationWeek={null} />);
    expect(screen.queryByText(/Adaptation Phase/)).toBeNull();
  });
});

describe('pre_cleanse follow-up ruling: RoutineStepCard renders stepNote as a plain info line', () => {
  it('shows the note text when stepNote is set', () => {
    render(
      <RoutineStepCard
        product={makeProduct({ productType: 'makeup_remover' })}
        stepNote="Follow with your cleanser — micellar water shouldn’t stay on skin."
      />,
    );
    expect(
      screen.getByText(/Follow with your cleanser — micellar water shouldn’t stay on skin\./),
    ).toBeTruthy();
  });

  it('renders no note line when stepNote is absent', () => {
    render(<RoutineStepCard product={makeProduct()} />);
    expect(screen.queryByText(/Follow with your cleanser/)).toBeNull();
  });

  it('renders no note line when stepNote is explicitly null (no cleanser on shelf)', () => {
    render(<RoutineStepCard product={makeProduct({ productType: 'makeup_remover' })} stepNote={null} />);
    expect(screen.queryByText(/Follow with your cleanser/)).toBeNull();
  });
});
