/**
 * Fixtures for the routine-similar-product-priority suite (qa-lead).
 *
 * Spec:        docs/specs/2026-07-11-routine-similar-product-priority.md
 * Tech design: docs/tech-design/routine-similar-product-priority.md
 *
 * The tech design deliberately leaves exact component prop shapes / testID
 * and accessibility conventions unspecified (it only names the files and the
 * pure-util signatures). Per the precedent in
 * tests/clinic-forecast-timeline/fixtures.ts, this header is the BINDING
 * contract qa-lead picked; engineer implements FE-6..FE-10 against it, not a
 * guess. Prop types are imported directly from the real (not-yet-existing)
 * component modules below so `tsc` catches any drift the moment they land —
 * these are all `import type`, which the TS/babel transform erases at
 * runtime, so this fixtures file itself loads fine before implementation;
 * only the individual *.test.tsx files (which import the real components as
 * values, to render them) fail to resolve until FE-6..FE-10 ship. That
 * failure is expected and normal for this qa-first pipeline stage.
 *
 * ── DuplicateSlotChoiceSheet (Story 1, FE-6) ──────────────────────────────
 *   props: { visible, slotLabel, existingProduct, incomingProduct, onReplace, onKeepBoth, onCancel }
 *   - Title text exactly: `You already have a ${slotLabel} in this routine`
 *   - existingProduct.name and incomingProduct.name both rendered as visible text
 *   - accessibilityRole="button" actions:
 *       accessibilityLabel={`Replace ${existingProduct.name}`}  (primary -> onReplace)
 *       accessibilityLabel="Keep both"                          (secondary -> onKeepBoth)
 *       accessibilityLabel="Cancel"                             (tertiary -> onCancel)
 *   - Backdrop press / onRequestClose also invokes onCancel (RemoveStepModal pattern).
 *
 * ── AddToRoutineSheet wiring (Story 1, FE-7) ──────────────────────────────
 *   - handleSave() calls routinesStore.findSameSlotConflict(routineId, productType,
 *     excludeProductId=pendingProduct.id) once per CHECKED period, before any
 *     upsertProductStep/replaceProductStep call for that period.
 *   - A non-null result opens DuplicateSlotChoiceSheet for that period before
 *     the step is committed (zero silent writes).
 *   - "Replace [existing]" -> replaceProductStep(routineId, existingProductId,
 *     { id: incoming.id, productType: incoming.productType }, scheduledDays);
 *     upsertProductStep is NOT called for that period.
 *   - "Keep both" -> upsertProductStep(routineId, incoming.id, incoming.productType,
 *     scheduledDays) exactly like today's no-conflict path; replaceProductStep is
 *     NOT called.
 *   - "Cancel" -> neither store write happens for that period; the choice sheet
 *     closes and Step 2 (schedule) remains on screen ("Add to routine" button
 *     still present) so the user can adjust and retry.
 *   - When BOTH Morning and Evening are checked and BOTH hit a same-slot conflict,
 *     the AM choice sheet resolves first; the PM choice sheet only appears AFTER
 *     an AM decision is made (tech design Assumption: "resolves them one period at
 *     a time (AM first)"). Cancelling the AM sheet aborts the whole save — the PM
 *     sheet never appears and neither period is written (AC4: "B is not added").
 *   - Exact-productId re-add (pendingProduct.id already a step in that routine)
 *     still calls findSameSlotConflict with excludeProductId=pendingProduct.id;
 *     the self-match must be excluded (returns null), so no sheet ever renders and
 *     upsertProductStep runs unchanged (AC5).
 *
 * ── DuplicateSlotWarningInline (Story 3, FE-8), sibling to ConflictWarningInline ──
 *   props: { routines, products, onPressGroup }
 *   - onPressGroup receives { routineId, slotIndex, productIds } for the tapped group.
 *   - Renders null when no routine has 2+ steps sharing a slot (other than `other`,
 *     index 7, which is always exempt).
 *   - Duplicate groups are computed PER ROUTINE, never merged across routines (a
 *     single moisturizer in AM + a single moisturizer in PM is NOT a duplicate).
 *   - One row per group: a Pressable (accessibilityRole="button") wrapping an
 *     InlineAlert tone="info". Both the visible text AND the Pressable's
 *     accessibilityLabel contain the product count + a human category label,
 *     e.g. "2 similar products (moisturizers) in this routine" — tests query it
 *     via getByLabelText/getByText interchangeably.
 *
 * ── DuplicateSlotResolutionSheet (Story 3, FE-9) ──────────────────────────
 *   props: { visible, onClose, routineId, slotLabel, rankedProducts }
 *   - rankedProducts arrives PRE-RANKED (best/recommended first, from FE-1's
 *     rankSlotGroup) — the sheet does not re-sort.
 *   - Index 0 renders a "Recommended" tag; no other row does.
 *   - Each row has a remove action, accessibilityLabel={`Remove ${product.name}`}.
 *   - Pressing remove opens a native Alert.alert confirmation; confirming (button
 *     text "Remove") calls routinesStore.removeProductStep(routineId, product.id);
 *     dismissing/"Cancel" removes nothing.
 *   - "Keep all" (accessibilityLabel="Keep all") calls onClose without any
 *     removeProductStep call.
 *
 * ── RoutinesScreen wiring (Story 3, FE-8/FE-9) ────────────────────────────
 *   - Renders DuplicateSlotWarningInline alongside the existing ConflictWarningInline.
 *   - Tapping a duplicate-group row calls `rankSlotGroup` (from
 *     src/utils/routineEngine/duplicateSlot) to build the ranked list, then opens
 *     DuplicateSlotResolutionSheet with that group's routineId + the ranked Product
 *     list. Ranking itself is a pure-util concern (engineer's unit tests) — this
 *     suite only asserts the WIRING (screen calls rankSlotGroup, passes its result
 *     + routineId straight through to the sheet).
 *
 * ── SlotAlternativeRow (Story 2, FE-10) ───────────────────────────────────
 *   props: { winnerProductName, alternativeProductName, onSwap }
 *   - Renders visible text containing `Also on your shelf: ${alternativeProductName}`.
 *   - A Pressable swap action, accessibilityLabel={`Swap to ${alternativeProductName}`},
 *     calling onSwap with no arguments (the parent already knows which alternative
 *     this row represents via closure).
 *
 * ── DraftPreviewSheet wiring (Story 2, FE-10) ─────────────────────────────
 *   - New prop: `onSwapAlternative(winnerProductId: string, chosenProductId: string): void`.
 *   - For every entry in `plan.slotAlternatives` whose `period` matches a rendered
 *     After-column step, one SlotAlternativeRow is rendered per recorded alternative,
 *     directly under that step's After-column name.
 *   - Pressing a SlotAlternativeRow's swap action calls
 *     onSwapAlternative(entry.winnerProductId, alternative.productId) — the sheet
 *     itself never calls applySlotAlternativeSwap directly; per tech design §1,
 *     RoutinesScreen owns rewriting the still-uncommitted draft.
 * ───────────────────────────────────────────────────────────────────────────
 */

import type { Product, ProductType, Routine, RoutineStep } from '@/types';
import type { RoutinePlan } from '@/utils/routineEngine/generate';
import type { PlannedStep, SlotAlternative } from '@/utils/routineEngine/planTypes';

// NOTE: these imports intentionally target components that do not exist yet.
// They are type-only (erased at runtime) so this fixtures file itself loads
// fine; the individual test files import the real components as VALUES to
// render them, and THOSE fail to resolve until FE-6..FE-10 land — expected,
// tests-first, per progress/routine-similar-product-priority.md.
import type { DuplicateSlotChoiceSheetProps } from '@/components/routine/DuplicateSlotChoiceSheet';
import type { DuplicateSlotWarningInlineProps } from '@/components/routine/DuplicateSlotWarningInline';
import type { DuplicateSlotResolutionSheetProps } from '@/components/routine/DuplicateSlotResolutionSheet';
import type { SlotAlternativeRowProps } from '@/components/routine/SlotAlternativeRow';

// ─── Product factory ──────────────────────────────────────────────────────────

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: nextId('product'),
    name: 'Product',
    brand: null,
    productType: 'moisturizer',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    isHidden: false,
    ...overrides,
  };
}

// ─── Named product fixtures (all share the "moisturizer" slot, index 11) ────

export const CREAM_A = makeProduct({ id: 'p-cream-a', name: 'Barrier Repair Cream', brand: 'Aveeno', productType: 'moisturizer' });
export const CREAM_B = makeProduct({ id: 'p-cream-b', name: 'Ceramide Moisturizer', brand: 'CeraVe', productType: 'moisturizer' });
export const SPF_A = makeProduct({ id: 'p-spf-a', name: 'Daily Defense SPF50', brand: 'La Roche-Posay', productType: 'spf' });
export const SPF_B = makeProduct({ id: 'p-spf-b', name: 'Mineral Sunscreen SPF30', brand: 'EltaMD', productType: 'spf' });
export const SERUM_UNIQUE = makeProduct({ id: 'p-serum-unique', name: 'Niacinamide Serum', brand: null, productType: 'serum' });

// ─── RoutineStep / Routine factories ──────────────────────────────────────────

export function makeStep(overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: nextId('step'),
    productType: 'moisturizer',
    productId: null,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

export function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: nextId('routine'),
    name: 'Morning',
    timeOfDay: 'morning',
    steps: [],
    ...overrides,
  };
}

// ─── Story 1: DuplicateSlotChoiceSheet prop factory ──────────────────────────

export function makeDuplicateSlotChoiceSheetProps(
  overrides: Partial<DuplicateSlotChoiceSheetProps> = {},
): DuplicateSlotChoiceSheetProps {
  return {
    visible: true,
    slotLabel: 'moisturizer',
    existingProduct: CREAM_A,
    incomingProduct: CREAM_B,
    onReplace: () => {},
    onKeepBoth: () => {},
    onCancel: () => {},
    ...overrides,
  };
}

// ─── Story 3: DuplicateSlotWarningInline prop factory ────────────────────────

export function makeDuplicateSlotWarningInlineProps(
  overrides: Partial<DuplicateSlotWarningInlineProps> = {},
): DuplicateSlotWarningInlineProps {
  return {
    routines: [],
    products: [],
    onPressGroup: () => {},
    ...overrides,
  };
}

// ─── Story 3: DuplicateSlotResolutionSheet prop factory ──────────────────────

export function makeDuplicateSlotResolutionSheetProps(
  overrides: Partial<DuplicateSlotResolutionSheetProps> = {},
): DuplicateSlotResolutionSheetProps {
  return {
    visible: true,
    onClose: () => {},
    routineId: 'routine-am',
    slotLabel: 'moisturizer',
    rankedProducts: [CREAM_A, CREAM_B],
    ...overrides,
  };
}

// ─── Story 2: SlotAlternativeRow prop factory ────────────────────────────────

export function makeSlotAlternativeRowProps(
  overrides: Partial<SlotAlternativeRowProps> = {},
): SlotAlternativeRowProps {
  return {
    winnerProductName: CREAM_A.name,
    alternativeProductName: CREAM_B.name,
    onSwap: () => {},
    ...overrides,
  };
}

// ─── Story 2: RoutinePlan + SlotAlternative factories ────────────────────────

export function makePlannedStep(overrides: Partial<PlannedStep> = {}): PlannedStep {
  return {
    productId: CREAM_A.id,
    productType: 'moisturizer' as ProductType,
    scheduledDays: [],
    slotIndex: 11,
    score: 0,
    addedAt: '2026-01-01',
    ...overrides,
  };
}

export function makeSlotAlternative(overrides: Partial<SlotAlternative> = {}): SlotAlternative {
  return {
    winnerProductId: CREAM_A.id,
    period: 'morning',
    slotIndex: 11,
    alternatives: [makePlannedStep({ productId: CREAM_B.id })],
    ...overrides,
  };
}

/**
 * A RoutinePlan admitting CREAM_A into Morning with CREAM_B recorded as its
 * one non-admitted same-slot alternative (Story 2 AC2). `slotAlternatives`
 * does not exist on RoutinePlan yet (FE-3) — this factory will fail `tsc`
 * (excess-property check) until it lands; that is the intended drift signal.
 */
export function makePlanWithAlternative(
  overrides: Partial<RoutinePlan> = {},
): RoutinePlan {
  return {
    rulesetVersion: 'test',
    generatedFor: '2026-07-11',
    periods: {
      morning: [makePlannedStep({ productId: CREAM_A.id })],
      evening: [],
    },
    frozen: [],
    placeholders: [],
    decisions: [],
    slotAlternatives: [makeSlotAlternative()],
    ...overrides,
  };
}
