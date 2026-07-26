/**
 * Shared fixtures for the routine-engine-v2.2 UI tests (skin conditions,
 * density insights, SPF adequacy).
 *
 * Factory return types are annotated with the real component prop types, so
 * prop drift fails `tsc` rather than only the test run.
 */
import type { ConditionSelectorProps } from '@/components/profile/ConditionSelector';
import type { ConflictWarningInlineProps } from '@/components/routine/ConflictWarningInline';
import type { RehabNoticeCardProps } from '@/components/routine/RehabNoticeCard';
import type {
  ActiveIngredientKey,
  Product,
  RehabNotice,
  Routine,
  RoutineStep,
} from '@/types';

let idCounter = 0;
const nextId = () => `fx-${++idCounter}`;

export function makeProduct(
  keys: ActiveIngredientKey[],
  overrides: Partial<Product> = {},
): Product {
  return {
    id: nextId(),
    name: `Product ${idCounter}`,
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: keys.map((key) => ({ key, displayName: key })),
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    spfValue: null,
    ...overrides,
  };
}

export function makeStep(productId: string, overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: nextId(),
    productType: 'serum',
    productId,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

export function makeRoutine(timeOfDay: Routine['timeOfDay'], products: Product[]): Routine {
  return {
    id: `r-${timeOfDay}-${nextId()}`,
    name: timeOfDay,
    timeOfDay,
    steps: products.map((p) => makeStep(p.id, { productType: p.productType })),
  };
}

/** Visible steps for one period — what ConflictWarningInline actually takes. */
export function makeVisibleSteps(products: Product[]): RoutineStep[] {
  return products.map((p) => makeStep(p.id, { productType: p.productType }));
}

export function makeConflictWarningInlineProps(
  overrides: Partial<ConflictWarningInlineProps> = {},
): ConflictWarningInlineProps {
  return {
    morningSteps: [],
    eveningSteps: [],
    products: [],
    skinConditions: [],
    ...overrides,
  };
}

export function makeConditionSelectorProps(
  overrides: Partial<ConditionSelectorProps> = {},
): ConditionSelectorProps {
  return {
    selected: [],
    onChange: jest.fn(),
    ...overrides,
  };
}

export function makeRehabNotice(overrides: Partial<RehabNotice> = {}): RehabNotice {
  return {
    key: 'proc-1',
    procedureName: 'Deep Chemical Peel',
    currentDay: 2,
    totalDays: 14,
    barrierStatus: 'disrupted',
    restrictions: ['Strictly indoor shelter or SPF 50+'],
    aggressive: true,
    ...overrides,
  };
}

export function makeRehabNoticeCardProps(
  overrides: Partial<RehabNoticeCardProps> = {},
): RehabNoticeCardProps {
  return {
    notice: makeRehabNotice(),
    conditionCaution: null,
    ...overrides,
  };
}
