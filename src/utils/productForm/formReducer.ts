import type { ActiveIngredientKey, AddProductDraft, ProductType } from '../../types';

export type FormAction =
  | { type: 'SET_BRAND'; value: string; source: AddProductDraft['brandSource'] }
  | { type: 'SET_NAME'; value: string; source: AddProductDraft['nameSource'] }
  | { type: 'SET_CATEGORY'; value: ProductType; source: 'auto-detected' | 'manual' }
  | { type: 'APPLY_LABEL_OCR_RESULT'; brand: string; name: string; detectedType: ProductType | null }
  | { type: 'SET_BARCODE'; value: string }
  | { type: 'SKIP_BARCODE' }
  | { type: 'APPLY_INCI_OCR_RESULT'; rawText: string; matchedKeys: ActiveIngredientKey[] }
  | { type: 'TOGGLE_ACTIVE_KEY'; key: ActiveIngredientKey }
  | { type: 'REMOVE_DETECTED_ACTIVE'; key: ActiveIngredientKey }
  | { type: 'SET_OPENED'; isOpened: boolean; date?: string }
  | { type: 'SET_PAO'; months: number }
  | { type: 'TOGGLE_SECTION'; section: 1 | 2 | 3 | 4 };

const isFilled = (value: string): boolean => value.trim().length > 0;

function brandSectionStatus(
  draft: Pick<AddProductDraft, 'brand' | 'name' | 'productType'>,
): AddProductDraft['sectionStatus']['brand'] {
  const filled = [isFilled(draft.brand), isFilled(draft.name), draft.productType !== null];
  if (filled.every(Boolean)) return 'complete';
  if (filled.some(Boolean)) return 'in-progress';
  return 'empty';
}

function ingredientsSectionStatus(
  draft: Pick<AddProductDraft, 'inciRaw' | 'activeIngredientKeys'>,
): AddProductDraft['sectionStatus']['ingredients'] {
  // Section 3 is optional: any captured data counts as complete, including the
  // valid "OCR'd but kept zero detected actives" state.
  if (draft.activeIngredientKeys.length > 0 || draft.inciRaw !== null) return 'complete';
  return 'empty';
}

function usageSectionStatus(
  draft: Pick<AddProductDraft, 'paoMonths'>,
): AddProductDraft['sectionStatus']['usage'] {
  return draft.paoMonths !== null ? 'complete' : 'empty';
}

function withBrandStatus(draft: AddProductDraft): AddProductDraft {
  return { ...draft, sectionStatus: { ...draft.sectionStatus, brand: brandSectionStatus(draft) } };
}

function withIngredientsStatus(draft: AddProductDraft): AddProductDraft {
  return {
    ...draft,
    sectionStatus: { ...draft.sectionStatus, ingredients: ingredientsSectionStatus(draft) },
  };
}

function toggleKey(
  keys: ActiveIngredientKey[],
  key: ActiveIngredientKey,
): ActiveIngredientKey[] {
  return keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
}

export function initialDraft(): AddProductDraft {
  return {
    brand: '',
    brandSource: null,
    name: '',
    nameSource: null,
    productType: null,
    productTypeSource: null,
    barcode: null,
    inciRaw: null,
    activeIngredientKeys: [],
    ingredientsSource: 'checklist',
    isOpened: false,
    openedDate: null,
    paoMonths: null,
    sectionStatus: {
      brand: 'empty',
      barcode: 'empty',
      ingredients: 'empty',
      usage: 'empty',
    },
    expandedSection: 1,
  };
}

export function formReducer(state: AddProductDraft, action: FormAction): AddProductDraft {
  switch (action.type) {
    case 'SET_BRAND':
      return withBrandStatus({ ...state, brand: action.value, brandSource: action.source });

    case 'SET_NAME':
      return withBrandStatus({ ...state, name: action.value, nameSource: action.source });

    case 'SET_CATEGORY':
      // Manual selection always wins: it simply overwrites source, and
      // APPLY_LABEL_OCR_RESULT below refuses to clobber a 'manual' source.
      return withBrandStatus({
        ...state,
        productType: action.value,
        productTypeSource: action.source,
      });

    case 'APPLY_LABEL_OCR_RESULT': {
      const keepManualCategory = state.productTypeSource === 'manual' || action.detectedType === null;
      return withBrandStatus({
        ...state,
        brand: action.brand,
        brandSource: 'ocr',
        name: action.name,
        nameSource: 'ocr',
        productType: keepManualCategory ? state.productType : action.detectedType,
        productTypeSource: keepManualCategory ? state.productTypeSource : 'auto-detected',
      });
    }

    case 'SET_BARCODE':
      return {
        ...state,
        barcode: action.value,
        sectionStatus: { ...state.sectionStatus, barcode: 'complete' },
      };

    case 'SKIP_BARCODE':
      return {
        ...state,
        barcode: null,
        sectionStatus: { ...state.sectionStatus, barcode: 'skipped' },
        expandedSection: 3,
      };

    case 'APPLY_INCI_OCR_RESULT': {
      const hadChecklistKeys = state.activeIngredientKeys.length > 0;
      const merged = [...state.activeIngredientKeys];
      for (const key of action.matchedKeys) {
        if (!merged.includes(key)) merged.push(key);
      }
      return withIngredientsStatus({
        ...state,
        inciRaw: action.rawText,
        activeIngredientKeys: merged,
        ingredientsSource: hadChecklistKeys ? 'mixed' : 'ocr',
      });
    }

    case 'TOGGLE_ACTIVE_KEY':
      return withIngredientsStatus({
        ...state,
        activeIngredientKeys: toggleKey(state.activeIngredientKeys, action.key),
        ingredientsSource: state.inciRaw !== null ? 'mixed' : 'checklist',
      });

    case 'REMOVE_DETECTED_ACTIVE':
      // Never clears inciRaw: keeping the raw text with zero confirmed
      // actives is a valid state.
      return withIngredientsStatus({
        ...state,
        activeIngredientKeys: state.activeIngredientKeys.filter((k) => k !== action.key),
      });

    case 'SET_OPENED': {
      const next = {
        ...state,
        isOpened: action.isOpened,
        openedDate: action.isOpened ? action.date ?? state.openedDate : null,
      };
      return { ...next, sectionStatus: { ...next.sectionStatus, usage: usageSectionStatus(next) } };
    }

    case 'SET_PAO': {
      const next = { ...state, paoMonths: action.months };
      return { ...next, sectionStatus: { ...next.sectionStatus, usage: usageSectionStatus(next) } };
    }

    case 'TOGGLE_SECTION':
      return {
        ...state,
        expandedSection: state.expandedSection === action.section ? null : action.section,
      };

    default:
      return state;
  }
}

export function canSave(state: AddProductDraft): boolean {
  return (
    isFilled(state.brand) &&
    isFilled(state.name) &&
    state.productType !== null &&
    state.paoMonths !== null
  );
}
