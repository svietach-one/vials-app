import type { SectionAccordionProps } from '@/components/addProduct/SectionAccordion';
import type { SaveBarProps } from '@/components/addProduct/SaveBar';
import type { AddProductDraft } from '@/types';
import { formReducer, initialDraft } from '@/utils/productForm/formReducer';
import type { FormAction } from '@/utils/productForm/formReducer';

/** Fresh draft with optional field overrides. */
export function makeDraft(overrides: Partial<AddProductDraft> = {}): AddProductDraft {
  return { ...initialDraft(), ...overrides };
}

/** Draft advanced through the reducer with real actions (keeps sectionStatus honest). */
export function makeDraftVia(...actions: FormAction[]): AddProductDraft {
  return actions.reduce(formReducer, initialDraft());
}

/** Draft that passes canSave: Section 1 complete + PAO set. */
export function makeCompleteDraft(): AddProductDraft {
  return makeDraftVia(
    { type: 'SET_BRAND', value: 'CeraVe', source: 'typed' },
    { type: 'SET_NAME', value: 'Foaming Cleanser', source: 'typed' },
    { type: 'SET_CATEGORY', value: 'cleanser', source: 'manual' },
    { type: 'SET_PAO', months: 12 },
  );
}

export function makeSectionAccordionProps(
  overrides: Partial<SectionAccordionProps> = {},
): SectionAccordionProps {
  return {
    index: 1,
    title: 'Brand, name, and category',
    status: 'empty',
    isExpanded: false,
    onToggle: jest.fn(),
    summary: null,
    children: null,
    ...overrides,
  };
}

export function makeSaveBarProps(overrides: Partial<SaveBarProps> = {}): SaveBarProps {
  return {
    enabled: true,
    onPress: jest.fn(),
    ...overrides,
  };
}
