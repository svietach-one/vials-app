import { deleteProductPhoto } from '@/services/productImage';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';

/**
 * Domain actions own operations that span multiple stores. Screens must call
 * these instead of composing store methods themselves, so cross-store
 * invariants (no ghost routine steps) hold in one place.
 */

/**
 * Deletes a product from the catalog and cascades the removal:
 * every routine step referencing it is purged (PRD US-08.1), and any
 * device-local photo copies + pending upload are cleaned up (img-01).
 */
export function deleteProductCascade(productId: string): void {
  const { routines, removeProductStep } = useRoutinesStore.getState();

  for (const routine of routines) {
    if (routine.steps.some((s) => s.productId === productId)) {
      removeProductStep(routine.id, productId);
    }
  }

  useProductsStore.getState().removeProduct(productId);

  // Fire-and-forget: photo cleanup never blocks or fails the delete.
  void deleteProductPhoto(productId);
}
