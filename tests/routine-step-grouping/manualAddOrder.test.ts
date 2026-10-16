/**
 * Field report 2026-10-16: adding an SPF, then a toner, then a moisturizer by
 * hand left the SPF in the middle of the routine, because `upsertProductStep`
 * appended every new step at the end. Driven through the REAL routines store.
 */
import { useRoutinesStore } from '@/store/routinesStore';
import type { ProductType, Routine } from '@/types';

const ROUTINE_ID = 'routine-am';

function emptyMorning(): Routine {
  return { id: ROUTINE_ID, name: 'Morning', timeOfDay: 'morning', steps: [] };
}

function addInOrder(entries: Array<[string, ProductType]>) {
  for (const [productId, productType] of entries) {
    useRoutinesStore.getState().upsertProductStep(ROUTINE_ID, productId, productType, []);
  }
}

const orderedTypes = () =>
  useRoutinesStore.getState().routines.find((r) => r.id === ROUTINE_ID)?.steps.map((s) => s.productType);

beforeEach(() => {
  useRoutinesStore.setState({ routines: [emptyMorning()] });
});

describe('manually added steps land in application order', () => {
  it('keeps the SPF last when it was added first', () => {
    addInOrder([
      ['spf', 'spf'],
      ['toner', 'toner'],
      ['moisturizer', 'moisturizer'],
    ]);

    expect(orderedTypes()).toEqual(['toner', 'moisturizer', 'spf']);
  });

  it('places a cleanser added last at the very top', () => {
    addInOrder([
      ['spf', 'spf'],
      ['moisturizer', 'moisturizer'],
      ['cleanser', 'cleanser'],
    ]);

    expect(orderedTypes()).toEqual(['cleanser', 'moisturizer', 'spf']);
  });

  it('does not move a step that is updated rather than added', () => {
    addInOrder([
      ['cleanser', 'cleanser'],
      ['moisturizer', 'moisturizer'],
      ['spf', 'spf'],
    ]);

    useRoutinesStore.getState().upsertProductStep(ROUTINE_ID, 'moisturizer', 'moisturizer', [1, 3]);

    expect(orderedTypes()).toEqual(['cleanser', 'moisturizer', 'spf']);
  });
});
