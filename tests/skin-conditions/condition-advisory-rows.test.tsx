/**
 * Component tests for the advisory stack on the routine screen (US-24, US-26,
 * US-27, US-28): condition advisories, density insights, and the no-op
 * guarantee for users who selected no condition.
 *
 * Spec: docs/specs/routine-engine-v2.2/ (PRD §4.2.2, §5.2; US-23–US-28)
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import {
  makeConflictWarningInlineProps,
  makeProduct,
  makeVisibleSteps,
} from './fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

import { ConflictWarningInline } from '@/components/routine/ConflictWarningInline';

describe('US-27: no condition selected changes nothing', () => {
  it('renders nothing at all for a routine with no conflicts and no conditions', () => {
    // Arrange
    const retinoid = makeProduct(['retinoid'], { name: 'Night Retinal' });
    const props = makeConflictWarningInlineProps({
      eveningSteps: makeVisibleSteps([retinoid]),
      products: [retinoid],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert
    expect(screen.queryByText(/sensitivity note/i)).toBeNull();
    expect(screen.queryByText(/routine insight/i)).toBeNull();
  });

  it('still renders the plain pairwise conflict row', () => {
    // Arrange
    const retinoid = makeProduct(['retinoid']);
    const acid = makeProduct(['aha']);
    const props = makeConflictWarningInlineProps({
      eveningSteps: makeVisibleSteps([retinoid, acid]),
      products: [retinoid, acid],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert
    expect(screen.getByText('Ingredient conflict')).toBeTruthy();
    expect(screen.queryByText(/because of a skin condition/i)).toBeNull();
  });
});

describe('only the steps the screen renders are considered', () => {
  // Regression: the component used to take whole routines and re-derive
  // visibility itself, so it warned about steps a clinical freeze had already
  // removed from the list (RoutinesScreen's frozenStepIds).
  it('ignores a catalog product that is not in the passed step lists', () => {
    // Arrange — the acid is on the shelf but its step was frozen out
    const retinoid = makeProduct(['retinoid'], { name: 'Night Retinal' });
    const frozenAcid = makeProduct(['aha'], { name: 'Glycolic Toner' });
    const props = makeConflictWarningInlineProps({
      eveningSteps: makeVisibleSteps([retinoid]),
      products: [retinoid, frozenAcid],
      skinConditions: ['eczema'],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert — no conflict row, and the advisory names only the visible product
    expect(screen.queryByText('Ingredient conflict')).toBeNull();
    expect(screen.queryByText(/Glycolic Toner/)).toBeNull();
    expect(screen.getByText(/Night Retinal/)).toBeTruthy();
  });

  it('raises no density finding from a frozen-out second product', () => {
    // Arrange
    const visible = makeProduct(['aha'], { name: 'Glycolic Toner' });
    const frozen = makeProduct(['bha'], { name: 'Salicylic Serum' });
    const props = makeConflictWarningInlineProps({
      eveningSteps: makeVisibleSteps([visible]),
      products: [visible, frozen],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert
    expect(screen.queryByText('Ingredient overlap')).toBeNull();
  });
});

describe('US-24: condition-aware rows', () => {
  it('adds a sensitivity note for a single relevant ingredient', () => {
    // Arrange
    const retinoid = makeProduct(['retinoid'], { name: 'Night Retinal' });
    const props = makeConflictWarningInlineProps({
      eveningSteps: makeVisibleSteps([retinoid]),
      products: [retinoid],
      skinConditions: ['rosacea'],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert
    expect(screen.getByText(/Sensitivity note · Rosacea/)).toBeTruthy();
  });

  it('marks an escalated pairwise conflict as condition-driven', () => {
    // Arrange — vitamin C + AHA is a 'caution' pair; eczema raises it
    const vitc = makeProduct(['vitamin_c_pure']);
    const acid = makeProduct(['aha']);
    const props = makeConflictWarningInlineProps({
      morningSteps: makeVisibleSteps([vitc, acid]),
      products: [vitc, acid],
      skinConditions: ['eczema'],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert
    expect(screen.getByText(/because of a skin condition in your profile/i)).toBeTruthy();
  });

  it('merges two conditions flagging one ingredient into a single row', () => {
    // Arrange
    const retinoid = makeProduct(['retinoid'], { name: 'Night Retinal' });
    const props = makeConflictWarningInlineProps({
      eveningSteps: makeVisibleSteps([retinoid]),
      products: [retinoid],
      skinConditions: ['eczema', 'rosacea'],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert — one row naming both conditions, not two near-identical rows
    expect(screen.getAllByText(/Sensitivity note/)).toHaveLength(1);
    expect(
      screen.getByText('Sensitivity note · Eczema / atopic dermatitis + Rosacea'),
    ).toBeTruthy();
  });

  it('never labels a single-ingredient advisory a conflict', () => {
    // Arrange
    const acid = makeProduct(['bha'], { name: 'BHA Toner' });
    const props = makeConflictWarningInlineProps({
      eveningSteps: makeVisibleSteps([acid]),
      products: [acid],
      skinConditions: ['eczema'],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert
    expect(screen.queryByText('Ingredient conflict')).toBeNull();
    expect(screen.getByText(/Sensitivity note/)).toBeTruthy();
  });
});

describe('US-28: density rows', () => {
  it('renders a Cobalt insight row for duplicated mild actives', () => {
    // Arrange
    const a = makeProduct(['vitamin_c_pure'], { name: 'C Serum' });
    const b = makeProduct(['vitamin_c_derivative'], { name: 'C Cream' });
    const props = makeConflictWarningInlineProps({
      morningSteps: makeVisibleSteps([a, b]),
      products: [a, b],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert — insight wording, and NOT the warning row title
    expect(screen.getByText('Routine insight')).toBeTruthy();
    expect(screen.queryByText('Ingredient overlap')).toBeNull();
    expect(screen.getByText(/likely will not add extra benefit/i)).toBeTruthy();
  });

  it('renders an Amber warning row for duplicated irritants', () => {
    // Arrange
    const a = makeProduct(['aha'], { name: 'Glycolic Toner' });
    const b = makeProduct(['bha'], { name: 'Salicylic Serum' });
    const props = makeConflictWarningInlineProps({
      eveningSteps: makeVisibleSteps([a, b]),
      products: [a, b],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert
    expect(screen.getByText('Ingredient overlap')).toBeTruthy();
    expect(screen.getByText(/Multiple exfoliating products are scheduled together/i)).toBeTruthy();
  });

  it('renders nothing for duplicated humectants', () => {
    // Arrange
    const a = makeProduct(['hyaluronic_acid']);
    const b = makeProduct(['hyaluronic_acid']);
    const props = makeConflictWarningInlineProps({
      morningSteps: makeVisibleSteps([a, b]),
      products: [a, b],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert
    expect(screen.queryByText('Routine insight')).toBeNull();
    expect(screen.queryByText('Ingredient overlap')).toBeNull();
  });

  it('escalates an insight into a warning when a condition targets it', () => {
    // Arrange
    const a = makeProduct(['vitamin_c_pure'], { name: 'C Serum' });
    const b = makeProduct(['vitamin_c_pure'], { name: 'C Cream' });
    const props = makeConflictWarningInlineProps({
      morningSteps: makeVisibleSteps([a, b]),
      products: [a, b],
      skinConditions: ['eczema'],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert
    expect(screen.getByText('Ingredient overlap')).toBeTruthy();
    expect(screen.queryByText('Routine insight')).toBeNull();
  });

  it('does not fire across periods', () => {
    // Arrange
    const am = makeProduct(['retinoid']);
    const pm = makeProduct(['retinoid']);
    const props = makeConflictWarningInlineProps({
      morningSteps: makeVisibleSteps([am]),
      eveningSteps: makeVisibleSteps([pm]),
      products: [am, pm],
    });
    // Act
    render(<ConflictWarningInline {...props} />);
    // Assert
    expect(screen.queryByText('Ingredient overlap')).toBeNull();
  });
});
