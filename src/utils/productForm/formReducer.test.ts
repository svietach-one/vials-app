import type { AddProductDraft } from '../../types';
import { canSave, formReducer, initialDraft, FormAction } from './formReducer';

const apply = (state: AddProductDraft, ...actions: FormAction[]): AddProductDraft =>
  actions.reduce(formReducer, state);

describe('initialDraft', () => {
  it('starts with Section 1 expanded and every section status empty', () => {
    const draft = initialDraft();

    expect(draft.expandedSection).toBe(1);
    expect(draft.sectionStatus).toEqual({
      brand: 'empty',
      barcode: 'empty',
      ingredients: 'empty',
      usage: 'empty',
    });
    expect(draft.brand).toBe('');
    expect(draft.name).toBe('');
    expect(draft.productType).toBeNull();
    expect(draft.barcode).toBeNull();
    expect(draft.inciRaw).toBeNull();
    expect(draft.activeIngredientKeys).toEqual([]);
    expect(draft.isOpened).toBe(false);
    expect(draft.openedDate).toBeNull();
    expect(draft.paoMonths).toBeNull();
  });
});

describe('Section 1 — brand, name, category', () => {
  it('marks brand section in-progress when only some fields are filled', () => {
    const draft = apply(initialDraft(), { type: 'SET_BRAND', value: 'CeraVe', source: 'typed' });

    expect(draft.brand).toBe('CeraVe');
    expect(draft.brandSource).toBe('typed');
    expect(draft.sectionStatus.brand).toBe('in-progress');
  });

  it('marks brand section complete when brand, name and category are all set', () => {
    const draft = apply(
      initialDraft(),
      { type: 'SET_BRAND', value: 'CeraVe', source: 'autocomplete' },
      { type: 'SET_NAME', value: 'Foaming Cleanser', source: 'typed' },
      { type: 'SET_CATEGORY', value: 'cleanser', source: 'manual' },
    );

    expect(draft.sectionStatus.brand).toBe('complete');
  });

  it('returns brand section to empty when the only filled field is cleared', () => {
    const draft = apply(
      initialDraft(),
      { type: 'SET_BRAND', value: 'CeraVe', source: 'typed' },
      { type: 'SET_BRAND', value: '   ', source: 'typed' },
    );

    expect(draft.sectionStatus.brand).toBe('empty');
  });

  it('applies label OCR result with ocr sources and auto-detected category', () => {
    const draft = apply(initialDraft(), {
      type: 'APPLY_LABEL_OCR_RESULT',
      brand: 'The Ordinary',
      name: 'Niacinamide 10% + Zinc 1%',
      detectedType: 'serum',
    });

    expect(draft.brand).toBe('The Ordinary');
    expect(draft.brandSource).toBe('ocr');
    expect(draft.name).toBe('Niacinamide 10% + Zinc 1%');
    expect(draft.nameSource).toBe('ocr');
    expect(draft.productType).toBe('serum');
    expect(draft.productTypeSource).toBe('auto-detected');
    expect(draft.sectionStatus.brand).toBe('complete');
  });

  it('does not clobber a manually picked category with a later OCR scan', () => {
    const draft = apply(
      initialDraft(),
      { type: 'SET_CATEGORY', value: 'cream', source: 'manual' },
      { type: 'APPLY_LABEL_OCR_RESULT', brand: 'B', name: 'N', detectedType: 'serum' },
    );

    expect(draft.productType).toBe('cream');
    expect(draft.productTypeSource).toBe('manual');
  });

  it('lets a manual category selection override an auto-detected one', () => {
    const draft = apply(
      initialDraft(),
      { type: 'APPLY_LABEL_OCR_RESULT', brand: 'B', name: 'N', detectedType: 'serum' },
      { type: 'SET_CATEGORY', value: 'toner', source: 'manual' },
    );

    expect(draft.productType).toBe('toner');
    expect(draft.productTypeSource).toBe('manual');
  });

  it('leaves category untouched when OCR detects nothing', () => {
    const draft = apply(initialDraft(), {
      type: 'APPLY_LABEL_OCR_RESULT',
      brand: 'B',
      name: 'N',
      detectedType: null,
    });

    expect(draft.productType).toBeNull();
    expect(draft.productTypeSource).toBeNull();
    expect(draft.sectionStatus.brand).toBe('in-progress');
  });
});

describe('Section 2 — barcode', () => {
  it('marks barcode section complete when a code is set', () => {
    const draft = apply(initialDraft(), { type: 'SET_BARCODE', value: '3337875597197' });

    expect(draft.barcode).toBe('3337875597197');
    expect(draft.sectionStatus.barcode).toBe('complete');
  });

  it('marks barcode skipped and auto-advances to the ingredients section on skip', () => {
    const start = apply(initialDraft(), { type: 'TOGGLE_SECTION', section: 2 });

    const draft = formReducer(start, { type: 'SKIP_BARCODE' });

    expect(draft.barcode).toBeNull();
    expect(draft.sectionStatus.barcode).toBe('skipped');
    expect(draft.expandedSection).toBe(3);
  });
});

describe('Section 3 — ingredients', () => {
  it('applies INCI OCR result with source ocr when no keys were picked before', () => {
    const draft = apply(initialDraft(), {
      type: 'APPLY_INCI_OCR_RESULT',
      rawText: 'Aqua, Niacinamide, Retinol',
      matchedKeys: ['niacinamide', 'retinoid'],
    });

    expect(draft.inciRaw).toBe('Aqua, Niacinamide, Retinol');
    expect(draft.activeIngredientKeys).toEqual(['niacinamide', 'retinoid']);
    expect(draft.ingredientsSource).toBe('ocr');
    expect(draft.sectionStatus.ingredients).toBe('complete');
  });

  it('merges OCR keys with prior checklist picks, deduped, as source mixed', () => {
    const draft = apply(
      initialDraft(),
      { type: 'TOGGLE_ACTIVE_KEY', key: 'niacinamide' },
      { type: 'APPLY_INCI_OCR_RESULT', rawText: 'Aqua, Niacinamide', matchedKeys: ['niacinamide', 'aha'] },
    );

    expect(draft.activeIngredientKeys).toEqual(['niacinamide', 'aha']);
    expect(draft.ingredientsSource).toBe('mixed');
  });

  it('toggles a checklist key on and off without duplicates', () => {
    const on = apply(initialDraft(), { type: 'TOGGLE_ACTIVE_KEY', key: 'aha' });
    expect(on.activeIngredientKeys).toEqual(['aha']);
    expect(on.ingredientsSource).toBe('checklist');
    expect(on.sectionStatus.ingredients).toBe('complete');

    const off = formReducer(on, { type: 'TOGGLE_ACTIVE_KEY', key: 'aha' });
    expect(off.activeIngredientKeys).toEqual([]);
    expect(off.sectionStatus.ingredients).toBe('empty');
  });

  it('marks source mixed when a key is toggled after an OCR scan', () => {
    const draft = apply(
      initialDraft(),
      { type: 'APPLY_INCI_OCR_RESULT', rawText: 'Aqua', matchedKeys: [] },
      { type: 'TOGGLE_ACTIVE_KEY', key: 'ceramides' },
    );

    expect(draft.ingredientsSource).toBe('mixed');
  });

  it('keeps inciRaw when the last detected active is removed', () => {
    const draft = apply(
      initialDraft(),
      { type: 'APPLY_INCI_OCR_RESULT', rawText: 'Aqua, Retinol', matchedKeys: ['retinoid'] },
      { type: 'REMOVE_DETECTED_ACTIVE', key: 'retinoid' },
    );

    expect(draft.activeIngredientKeys).toEqual([]);
    expect(draft.inciRaw).toBe('Aqua, Retinol');
    expect(draft.sectionStatus.ingredients).toBe('complete');
  });
});

describe('Section 4 — usage', () => {
  it('stores the opened date only while isOpened is true', () => {
    const opened = apply(initialDraft(), {
      type: 'SET_OPENED',
      isOpened: true,
      date: '2026-07-01',
    });
    expect(opened.isOpened).toBe(true);
    expect(opened.openedDate).toBe('2026-07-01');

    const closed = formReducer(opened, { type: 'SET_OPENED', isOpened: false });
    expect(closed.isOpened).toBe(false);
    expect(closed.openedDate).toBeNull();
  });

  it('marks usage complete once PAO is set', () => {
    const draft = apply(initialDraft(), { type: 'SET_PAO', months: 12 });

    expect(draft.paoMonths).toBe(12);
    expect(draft.sectionStatus.usage).toBe('complete');
  });
});

describe('TOGGLE_SECTION', () => {
  it('opens the tapped section and closes the previously expanded one', () => {
    const draft = apply(initialDraft(), { type: 'TOGGLE_SECTION', section: 3 });

    expect(draft.expandedSection).toBe(3);
  });

  it('collapses the currently expanded section when tapped again', () => {
    const draft = apply(
      initialDraft(),
      { type: 'TOGGLE_SECTION', section: 2 },
      { type: 'TOGGLE_SECTION', section: 2 },
    );

    expect(draft.expandedSection).toBeNull();
  });
});

describe('canSave', () => {
  it('is false on a fresh draft', () => {
    expect(canSave(initialDraft())).toBe(false);
  });

  it('is true when Section 1 and PAO are set, regardless of barcode and ingredients', () => {
    const draft = apply(
      initialDraft(),
      { type: 'SET_BRAND', value: 'CeraVe', source: 'typed' },
      { type: 'SET_NAME', value: 'Foaming Cleanser', source: 'typed' },
      { type: 'SET_CATEGORY', value: 'cleanser', source: 'manual' },
      { type: 'SET_PAO', months: 12 },
    );

    expect(canSave(draft)).toBe(true);
    expect(draft.barcode).toBeNull();
    expect(draft.activeIngredientKeys).toEqual([]);
  });

  it('is false while PAO is missing even with Section 1 complete', () => {
    const draft = apply(
      initialDraft(),
      { type: 'SET_BRAND', value: 'CeraVe', source: 'typed' },
      { type: 'SET_NAME', value: 'Foaming Cleanser', source: 'typed' },
      { type: 'SET_CATEGORY', value: 'cleanser', source: 'manual' },
    );

    expect(canSave(draft)).toBe(false);
  });
});
