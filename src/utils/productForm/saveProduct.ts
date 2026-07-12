import { ACTIVE_INGREDIENT_LABELS } from '../../constants/labels';
import type { AddProductDraft, Product, SuggestPayload } from '../../types';

/**
 * Maps a completed wizard draft to a shelf Product. Pure — id and timestamp
 * are injected so this stays unit-testable. Caller must have verified
 * canSave(draft) first (productType/paoMonths are asserted non-null here).
 */
export function buildProductFromDraft(
  draft: AddProductDraft,
  id: string,
  nowIso: string,
): Product {
  if (draft.productType === null) {
    throw new Error('buildProductFromDraft called before canSave passed');
  }
  return {
    id,
    name: draft.name.trim(),
    brand: draft.brand.trim() || null,
    productType: draft.productType,
    imageUrl: null,
    activeIngredients: draft.activeIngredientKeys.map((key) => ({
      key,
      displayName: ACTIVE_INGREDIENT_LABELS[key],
    })),
    activeTags: [...draft.activeIngredientKeys],
    fullIngredientText: draft.inciRaw,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: nowIso,
    notes: null,
    openedDate: draft.isOpened ? draft.openedDate : null,
    paoMonths: draft.paoMonths,
    barcode: draft.barcode,
    // The wizard is the manual / barcode-not-found path by definition; the
    // OBF-prefill path lives in ManualProductFormScreen ('obf_import').
    source: 'user_local',
  };
}

/**
 * PRIVACY BOUNDARY. Builds the background-suggest payload from a draft.
 * openedDate, isOpened, and paoMonths must NEVER appear here — enforced
 * structurally by SuggestPayload being a hand-declared interface (never an
 * Omit<Product, …>), and by this literal listing every field explicitly.
 * The checklist-derived activeIngredientKeys also stay local-only: they are
 * a client-side convenience parse, not submission-quality raw INCI text.
 */
export function buildSuggestPayload(draft: AddProductDraft): SuggestPayload {
  if (draft.productType === null) {
    throw new Error('buildSuggestPayload called before canSave passed');
  }
  return {
    brand: draft.brand.trim(),
    name: draft.name.trim(),
    productType: draft.productType,
    barcode: draft.barcode,
    inciRaw: draft.inciRaw,
    status: 'pending',
  };
}
