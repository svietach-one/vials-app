import { useRoutinesStore } from '@/store/routinesStore';
import { generateId } from '@/utils/generateId';
import type { Product, RoutineStep } from '@/types';
import type { RoutineTarget } from '@/types';

/**
 * Returns a stable callback that adds a product to the morning and/or
 * evening routine based on the chosen RoutineTarget.
 */
export function useRoutineLinking() {
  const routines = useRoutinesStore((s) => s.routines);
  const updateRoutine = useRoutinesStore((s) => s.updateRoutine);

  function addProductToRoutine(product: Product, target: RoutineTarget) {
    if (target === 'none') return;

    function makeStep(): RoutineStep {
      return {
        id: generateId(),
        productType: product.productType,
        productId: product.id,
        hidden: false,
        scheduledDays: [],
      };
    }

    if (target === 'morning' || target === 'both') {
      const r = routines.find((x) => x.timeOfDay === 'morning');
      if (r) updateRoutine(r.id, { steps: [...r.steps, makeStep()] });
    }
    if (target === 'evening' || target === 'both') {
      const r = routines.find((x) => x.timeOfDay === 'evening');
      if (r) updateRoutine(r.id, { steps: [...r.steps, makeStep()] });
    }
  }

  return { addProductToRoutine };
}
