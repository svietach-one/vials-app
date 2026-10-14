import type { Product, Routine, RoutineStep } from '@/types';
import { findPreCleanseReminder } from '@/utils/routineEngine/preCleanseReminder';

let idCounter = 0;
function makeProduct(overrides: Partial<Product> = {}): Product {
  idCounter += 1;
  return {
    id: `p${idCounter}`,
    name: `Product ${idCounter}`,
    brand: null,
    productType: 'moisturizer',
    imageUrl: null,
    activeIngredients: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

function makeStep(product: Product, overrides: Partial<RoutineStep> = {}): RoutineStep {
  idCounter += 1;
  return {
    id: `s${idCounter}`,
    productType: product.productType,
    productId: product.id,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

function makeEveningRoutine(steps: RoutineStep[]): Routine {
  return { id: 'routine-evening', name: 'Evening', timeOfDay: 'evening', steps };
}

describe('findPreCleanseReminder', () => {
  it('returns null when the evening routine has no pre_cleanse (makeup remover) step', () => {
    const cleanser = makeProduct({ productType: 'cleanser' });
    const routines = [makeEveningRoutine([makeStep(cleanser)])];
    expect(findPreCleanseReminder(routines, [cleanser])).toBeNull();
  });

  it('returns null when a cleanser fully covers the makeup remover\'s scheduled days', () => {
    const remover = makeProduct({ productType: 'makeup_remover', name: 'Micellar Water' });
    const cleanser = makeProduct({ productType: 'cleanser', name: 'Face Wash' });
    const routines = [
      makeEveningRoutine([
        makeStep(remover, { scheduledDays: [1, 3, 5] }),
        makeStep(cleanser, { scheduledDays: [] }), // empty = every day
      ]),
    ];
    expect(findPreCleanseReminder(routines, [remover, cleanser])).toBeNull();
  });

  it('flags the makeup remover step when no cleanser is scheduled at all', () => {
    const remover = makeProduct({ productType: 'makeup_remover', name: 'Micellar Water' });
    const routines = [makeEveningRoutine([makeStep(remover)])];

    const reminder = findPreCleanseReminder(routines, [remover]);
    expect(reminder).not.toBeNull();
    expect(reminder?.productName).toBe('Micellar Water');
  });

  it('flags it when the cleanser runs on fewer days than the makeup remover (day-split, not a real follow-up)', () => {
    const remover = makeProduct({ productType: 'makeup_remover', name: 'Micellar Water' });
    const cleanser = makeProduct({ productType: 'cleanser' });
    const routines = [
      makeEveningRoutine([
        makeStep(remover, { scheduledDays: [1, 3, 5] }),
        makeStep(cleanser, { scheduledDays: [1] }), // only covers Monday
      ]),
    ];

    expect(findPreCleanseReminder(routines, [remover, cleanser])).not.toBeNull();
  });

  it('ignores a hidden makeup remover step', () => {
    const remover = makeProduct({ productType: 'makeup_remover' });
    const routines = [makeEveningRoutine([makeStep(remover, { hidden: true })])];
    expect(findPreCleanseReminder(routines, [remover])).toBeNull();
  });

  it('ignores a hidden cleanser step (treats it as not covering)', () => {
    const remover = makeProduct({ productType: 'makeup_remover', name: 'Micellar Water' });
    const cleanser = makeProduct({ productType: 'cleanser' });
    const routines = [
      makeEveningRoutine([
        makeStep(remover),
        makeStep(cleanser, { hidden: true }),
      ]),
    ];

    expect(findPreCleanseReminder(routines, [remover, cleanser])).not.toBeNull();
  });

  it('returns null when there is no evening routine at all', () => {
    const remover = makeProduct({ productType: 'makeup_remover' });
    const morning: Routine = { id: 'routine-morning', name: 'Morning', timeOfDay: 'morning', steps: [makeStep(remover)] };
    expect(findPreCleanseReminder([morning], [remover])).toBeNull();
  });

  it('returns null when two day-split cleansers together cover the makeup remover\'s days', () => {
    const remover = makeProduct({ productType: 'makeup_remover', name: 'Micellar Water' });
    const foam = makeProduct({ productType: 'cleanser', name: 'BHA Foam' });
    const gel = makeProduct({ productType: 'cleanser', name: 'Gentle Gel' });
    const routines = [
      makeEveningRoutine([
        makeStep(remover, { scheduledDays: [] }),
        makeStep(foam, { scheduledDays: [1, 3, 5] }),
        makeStep(gel, { scheduledDays: [0, 2, 4, 6] }),
      ]),
    ];
    expect(findPreCleanseReminder(routines, [remover, foam, gel])).toBeNull();
  });

  it('still flags the makeup remover when the day-split cleansers leave a day uncovered', () => {
    const remover = makeProduct({ productType: 'makeup_remover', name: 'Micellar Water' });
    const foam = makeProduct({ productType: 'cleanser', name: 'BHA Foam' });
    const gel = makeProduct({ productType: 'cleanser', name: 'Gentle Gel' });
    const routines = [
      makeEveningRoutine([
        makeStep(remover, { scheduledDays: [] }),
        makeStep(foam, { scheduledDays: [1, 3, 5] }),
        makeStep(gel, { scheduledDays: [0, 2, 4] }),
      ]),
    ];
    expect(findPreCleanseReminder(routines, [remover, foam, gel])?.stepId).toBe(routines[0].steps[0].id);
  });

  it('stays silent on a weekday the cleanser IS scheduled, even if another night is uncovered', () => {
    // Field report 2026-10-14: viewing Wednesday, with the cleanser rendered
    // directly below the micellar water, still showed the banner.
    const remover = makeProduct({ productType: 'makeup_remover', name: 'Micellar Water' });
    const foam = makeProduct({ productType: 'cleanser', name: 'BHA Foam' });
    const routines = [
      makeEveningRoutine([
        makeStep(remover, { scheduledDays: [] }), // every night
        makeStep(foam, { scheduledDays: [3] }), // Wednesday only
      ]),
    ];

    expect(findPreCleanseReminder(routines, [remover, foam], 3)).toBeNull();
  });

  it('flags the makeup remover on a weekday the cleanser is NOT scheduled', () => {
    const remover = makeProduct({ productType: 'makeup_remover', name: 'Micellar Water' });
    const foam = makeProduct({ productType: 'cleanser', name: 'BHA Foam' });
    const routines = [
      makeEveningRoutine([
        makeStep(remover, { scheduledDays: [] }),
        makeStep(foam, { scheduledDays: [3] }),
      ]),
    ];

    expect(findPreCleanseReminder(routines, [remover, foam], 4)?.stepId).toBe(routines[0].steps[0].id);
  });
});
