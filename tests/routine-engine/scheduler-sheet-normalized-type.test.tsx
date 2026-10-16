/**
 * RoutineSchedulerSheet persists the NORMALISED product type (tech-lead W-A).
 *
 * Three screens (Catalog, Product detail, Routines) hand the sheet the RAW
 * `product.productType`. For an enzyme cream that wrote an `enzE:cream` step into
 * the evening while the engine wrote `enzE:peeling` into the morning, and the
 * similar-products notice then fired against the user's plain cream. The sheet is
 * the one sink all five call sites share, so it resolves the type itself from the
 * product it is scheduling (normalizeProductType), the same guard the engine and
 * AddToRoutineSheet use. Real stores; only storage and safe-area are mocked.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/services/storage', () => {
  const actual = jest.requireActual('@/services/storage');
  return { ...actual, saveJson: jest.fn(async () => undefined), loadJson: jest.fn(async (_k: string, f: unknown) => f) };
});

import { RoutineSchedulerSheet } from '@/components/routine/RoutineSchedulerSheet';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import type { ProductType } from '@/types';
import { makeProduct, makeRoutine, resetFixtureCounters } from './fixtures';

const enzymeCream = () => makeProduct({ id: 'enz', name: 'Enzyme Cream', productType: 'moisturizer', activeTags: ['enzyme_exfoliant'] });
const plainCream = () => makeProduct({ id: 'plain', name: 'Plain Cream', productType: 'moisturizer' });
const micellar = () => makeProduct({ id: 'mw', name: 'Micellar Water', productType: 'cleanser' });

beforeEach(() => {
  resetFixtureCounters();
  useProductsStore.setState({ products: [enzymeCream(), plainCream(), micellar()] });
  useRoutinesStore.setState({ routines: [makeRoutine('morning', []), makeRoutine('evening', [])] });
});

/** Opens the sheet for `productId` with the RAW type a call site passes, checks Morning and Evening, saves. */
function scheduleBothPeriods(productId: string, rawType: ProductType) {
  render(<RoutineSchedulerSheet visible productId={productId} productType={rawType} onClose={() => {}} />);
  fireEvent.press(screen.getByLabelText('Morning'));
  fireEvent.press(screen.getByLabelText('Evening'));
  fireEvent.press(screen.getByText('Save'));
}

const typesOf = (productId: string) =>
  useRoutinesStore
    .getState()
    .routines.map((r) => [r.timeOfDay, r.steps.find((s) => s.productId === productId)?.productType]);

describe('the step type written by the scheduler sheet', () => {
  it('is peeling for an enzyme cream in BOTH periods, whatever raw type the call site passes', () => {
    scheduleBothPeriods('enz', 'moisturizer');

    expect(typesOf('enz')).toEqual([['morning', 'peeling'], ['evening', 'peeling']]);
  });

  it('stays moisturizer for a plain cream', () => {
    scheduleBothPeriods('plain', 'moisturizer');

    expect(typesOf('plain')).toEqual([['morning', 'moisturizer'], ['evening', 'moisturizer']]);
  });

  it('is makeup_remover for micellar water typed as a cleanser (the raw-type path used to persist cleanser here too)', () => {
    scheduleBothPeriods('mw', 'cleanser');

    expect(typesOf('mw')).toEqual([['morning', 'makeup_remover'], ['evening', 'makeup_remover']]);
  });

  it('falls back to the type it was given when the product is not in the store', () => {
    scheduleBothPeriods('unknown-id', 'serum');

    expect(typesOf('unknown-id')).toEqual([['morning', 'serum'], ['evening', 'serum']]);
  });
});
