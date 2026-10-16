import type { ProductType, RoutineStep } from '@/types';
import { insertStepByLayering } from '@/utils/stepInsertion';

let n = 0;
function step(productType: ProductType): RoutineStep {
  n += 1;
  return { id: `s${n}`, productType, productId: `p${n}`, hidden: false, scheduledDays: [] };
}
const types = (steps: RoutineStep[]) => steps.map((s) => s.productType);

describe('insertStepByLayering', () => {
  it('puts a moisturizer before an SPF that was added first', () => {
    const result = insertStepByLayering([step('spf')], step('moisturizer'));
    expect(types(result)).toEqual(['moisturizer', 'spf']);
  });

  it('builds cleanser, toner, moisturizer, SPF from SPF-first manual adds (field report 2026-10-16)', () => {
    let steps: RoutineStep[] = [];
    for (const t of ['spf', 'toner', 'moisturizer', 'cleanser'] as ProductType[]) {
      steps = insertStepByLayering(steps, step(t));
    }
    expect(types(steps)).toEqual(['cleanser', 'toner', 'moisturizer', 'spf']);
  });

  it('appends an SPF after everything, including oil and balm which share the last-but-one layer', () => {
    const result = insertStepByLayering([step('cleanser'), step('moisturizer'), step('oil')], step('spf'));
    expect(types(result)).toEqual(['cleanser', 'moisturizer', 'oil', 'spf']);
  });

  it('appends to an empty routine', () => {
    expect(types(insertStepByLayering([], step('toner')))).toEqual(['toner']);
  });

  it('places a step after steps on its own layer, so an earlier add stays first', () => {
    const first = step('cream');
    const result = insertStepByLayering([first, step('spf')], step('lotion'));
    expect(result[0]).toBe(first);
    expect(types(result)).toEqual(['cream', 'lotion', 'spf']);
  });

  it('never re-sorts the steps already there: their relative order survives an insert', () => {
    // The user dragged the moisturizer above the cleanser; an insert must not undo that.
    const dragged = [step('moisturizer'), step('cleanser')];
    const added = step('toner');

    const result = insertStepByLayering(dragged, added);

    expect(result.filter((s) => s !== added)).toEqual(dragged);
    // The new step goes before the first step on a higher layer (the moisturizer).
    expect(result.indexOf(added)).toBe(0);
  });

  it('does not mutate the input array', () => {
    const input = [step('spf')];
    insertStepByLayering(input, step('toner'));
    expect(input).toHaveLength(1);
  });
});
