/**
 * Fixtures for the routine-step-grouping suite (qa-lead).
 *
 * Spec:    docs/specs/routine-step-grouping/PRD_Spec.md
 *          docs/specs/routine-step-grouping/SCREENS.md
 *          docs/specs/routine-step-grouping/USER_STORIES.md
 *          docs/specs/routine-step-grouping/IMPLEMENTATION_PLAN.md
 *
 * None of the modules referenced below exist yet. This file (and every
 * *.test.tsx in this folder) is written BEFORE the engineer's implementation,
 * per the qa-lead -> engineer handoff (.claude/rules/agent-layer-protocol.md).
 * `import type` lines are erased at runtime and only fail `tsc`; the `import`
 * (value) lines inside each *.test.tsx file are what actually fail to
 * resolve until the engineer lands Phases 1-6. That failure is expected and
 * correct for this pipeline stage (see precedent:
 * tests/routine-similar-product-priority/fixtures.ts).
 *
 * The spec package documents WHAT must be true (grouping invariant,
 * transition table, completion semantics) but not the literal prop shapes,
 * copy strings, testIDs or accessibility labels of the new components.
 * Those are pinned here as the BINDING CONTRACT the engineer implements
 * against — not a guess, and not to be silently changed without updating
 * this file and the tests that depend on it.
 *
 * ── New types (src/types/index.ts, Phase 1) ───────────────────────────────
 *   export type StepAction =
 *     | 'cleanse' | 'exfoliate' | 'tone' | 'treat'
 *     | 'moisturize' | 'mask' | 'seal' | 'protect';
 *   export type Zone = 'face' | 'eyes' | 'neck' | 'lips' | 'hands';
 *   export type StepTiming = 'inline' | 'reapply';
 *   export type StepTransition =
 *     | { kind: 'note'; text: 'dry_skin' | 'immediate' | 'until_dry' | 'before_sun' }
 *     | { kind: 'none' };
 *   Product gains: zones?: Zone[]; timing?: StepTiming; reapplyAfterHours?: number;
 *
 * ── src/constants/rulesets/stepActions.ts (Phase 1) ───────────────────────
 *   STEP_ACTION_LABELS: Record<StepAction, string> = Cleanse / Exfoliate /
 *   Tone / Treat / Moisturize / Mask / Seal / Protect (Title Case, one word).
 *   STEP_ACTION_FOR_TYPE: Record<ProductType, StepAction> — the 18-entry
 *   table in PRD_Spec.md §3.2.
 *
 * ── StepGroupHeader (src/components/routine/StepGroupHeader.tsx, Phase 4) ─
 *   props: { ordinal: number; action: StepAction; allCompleted?: boolean;
 *            editMode?: boolean }
 *   - Renders visible text exactly `${ordinal}. ${STEP_ACTION_LABELS[action]}`
 *     (e.g. "3. Moisturize"), queryable via getByText.
 *   - The header's own accessibilityLabel equals that same string, with
 *     ", all done" appended when allCompleted is true — queryable via
 *     getByLabelText so the dimmed state is assertable without touching
 *     style internals.
 *   - editMode: true renders an additional element with
 *     testID="step-group-drag-handle" (drag affordance). Absent otherwise.
 *
 * ── RoutineProductCard (src/components/routine/RoutineProductCard.tsx,
 *    Phase 4 — replaces RoutineStepCard) ────────────────────────────────────
 *   props: {
 *     product: Product;
 *     displayProductType?: ProductType;
 *     completed: boolean;
 *     editMode: boolean;
 *     tappable: boolean;            // only consulted when editMode is false
 *     onToggleComplete?: () => void;
 *     onOpenActionSheet?: () => void; // edit-mode body tap
 *     onPausePress?: () => void;      // edit-mode pause icon
 *     onSchedulePress?: () => void;   // edit-mode schedule icon
 *     conflictingProductName?: string | null;
 *     similarProductName?: string | null;  // routine-step-grouping polish round 3
 *     adaptationWeek?: number | null;
 *   }
 *   Rendering contract:
 *   - Root is a single Pressable, testID="routine-product-card",
 *     accessibilityRole="button", accessibilityState={{ checked: completed }},
 *     accessibilityLabel containing brand, product name, the zone-tag text
 *     (if any) and the literal word "completed" or "not completed".
 *   - Meta line (testID="meta-line") is rendered iff there is a zone tag
 *     and/or a reapply annotation to show; omitted (not just empty) otherwise.
 *   - Zone tag: product.zones undefined, [], or exactly ['face'] -> no zone
 *     segment anywhere (not on the card, not in the accessibility label).
 *     Otherwise: each zone Title-Cased (face->Face, eyes->Eyes, neck->Neck,
 *     lips->Lips, hands->Hands), joined in array order with " · " — e.g.
 *     ['eyes','neck'] -> "Eyes · Neck". Queryable via getByText.
 *   - Reapply annotation: rendered only when product.timing === 'reapply',
 *     exact text `reapply after ~${product.reapplyAfterHours} h`.
 *   - Right cluster occupies exactly one state at a time:
 *       editMode === true: testID="pause-icon" (accessibilityLabel "Pause",
 *         calls onPausePress) and testID="schedule-icon" (accessibilityLabel
 *         "Schedule", calls onSchedulePress). No completed badge, no status
 *         badges (testID="completed-badge" and testID="active-badge-<key>"
 *         both absent).
 *       editMode === false && completed === true: testID="completed-badge"
 *         with visible text "Completed". Status badges
 *         (testID="active-badge-<key>") absent.
 *       editMode === false && completed === false: status badges render,
 *         same convention as the current RoutineStepCard
 *         (testID={`active-badge-${activeKey}`} when the product carries an
 *         active tag) — completed-badge absent.
 *   - Tap on the root (testID="routine-product-card"):
 *       editMode true -> calls onOpenActionSheet only.
 *       editMode false, tappable true -> calls onToggleComplete only.
 *       editMode false, tappable false -> calls neither (silent no-op).
 *
 * ── StepTransitionDivider (src/components/routine/StepTransitionDivider.tsx,
 *    Phase 4) ─────────────────────────────────────────────────────────────
 *   props: { transition: StepTransition }
 *   - kind: 'none' -> renders null (toJSON() === null).
 *   - kind: 'note' -> renders visible text, exact copy by `text`:
 *       dry_skin    -> "on dry skin"
 *       immediate   -> "apply next right away"
 *       until_dry   -> "until fully dry"
 *       before_sun  -> "~15 min before sun exposure"
 *   - Non-interactive: no accessibilityRole="button" anywhere in the tree.
 *
 * ── GapCard (src/components/routine/GapCard.tsx, Phase 4) ─────────────────
 *   props: { label: string; onFindInCatalog: () => void }
 *   - Visible text exactly `No ${label} in your shelf`.
 *   - One action, visible text "Find in catalog", accessibilityRole="button",
 *     calls onFindInCatalog.
 *
 * ── OrphanedSlotCard (src/components/routine/OrphanedSlotCard.tsx, Phase 6) ─
 *   props: { onAddFromCatalog: () => void; onPause: () => void }
 *   - Visible text exactly "Product removed".
 *   - Two actions: "Add from catalog" (accessibilityRole="button") calls
 *     onAddFromCatalog; "Pause" (accessibilityRole="button") calls onPause.
 *   - Must share no component and no copy string with GapCard (US-44 negative).
 *
 * ── completionStore (src/store/completionStore.ts, Phase 5) ───────────────
 *   State (as mocked at the RoutinesScreen wiring level — engineer's own
 *   store unit tests are co-located, not this file's concern):
 *     isCompleted(productId: string, routineId: string, date: string): boolean
 *     toggleCompleted(productId: string, routineId: string, date: string): void
 *   RoutinesScreen resolves `date` via the existing 04:00-boundary helper
 *   `getSkincareDateString` (src/utils/timeHelpers.ts) — reused, not
 *   reimplemented (PRD_Spec.md §6.2, IMPLEMENTATION_PLAN.md Phase 5).
 *
 * ── RoutinesScreen (Phase 4/5/6 changes) ───────────────────────────────────
 *   - Renders StepGroupHeader + RoutineProductCard (+ StepTransitionDivider
 *     between adjacent rendered groups, + GapCard/OrphanedSlotCard) instead
 *     of a flat RoutineStepCard list, inside each already-existing
 *     Morning/Evening accordion PeriodCard (the accordion chrome itself is
 *     UNCHANGED by this package — see progress log for why the segmented-
 *     control description in SCREENS.md §2.2 is stale against shipped code).
 *   - A new edit-mode toggle in the header: entering shows
 *     accessibilityLabel "Edit routine"; once pressed, that label disappears
 *     and accessibilityLabel "Done editing" appears in its place.
 *   - Gap cards are sourced from `validateCurrentRoutines().proposedPlan
 *     .placeholders` (already computed by the existing `validation` memo —
 *     only its `hasBlockingFindings` field is read today), matched into the
 *     step group for the placeholder's first `productTypes` entry.
 *   - Orphaned-slot cards are sourced from a persisted RoutineStep with
 *     `productId: null` — today such a step is silently dropped
 *     (`if (!product) return null` in `renderStepItem`); this package fixes
 *     that drop into a rendered OrphanedSlotCard.
 * ───────────────────────────────────────────────────────────────────────────
 */

import type {
  Product,
  ProductType,
  Routine,
  RoutineStep,
  StepAction,
  StepTiming,
  StepTransition,
  Zone,
} from '@/types';

// NOTE: type-only imports of not-yet-existing component prop interfaces.
// Erased at runtime (fine for this file); the individual *.test.tsx files
// import the real components as VALUES, which is what actually fails to
// resolve until the engineer implements Phases 1-6.
import type { StepGroupHeaderProps } from '@/components/routine/StepGroupHeader';
import type { RoutineProductCardProps } from '@/components/routine/RoutineProductCard';
import type { StepTransitionDividerProps } from '@/components/routine/StepTransitionDivider';
import type { GapCardProps } from '@/components/routine/GapCard';
import type { OrphanedSlotCardProps } from '@/components/routine/OrphanedSlotCard';

// ─── Id sequence ──────────────────────────────────────────────────────────────

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

// ─── Product factory ──────────────────────────────────────────────────────────

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: nextId('product'),
    name: 'Product',
    brand: null,
    productType: 'serum',
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

// ─── RoutineStep / Routine factories ──────────────────────────────────────────

export function makeStep(overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: nextId('step'),
    productType: 'serum',
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

// ─── Named product fixtures — one per StepAction bucket ──────────────────────
// productType values and their StepAction mapping mirror PRD_Spec.md §3.2.

export const MAKEUP_REMOVER = makeProduct({ id: 'p-remover', name: 'Micellar Water', brand: 'Bioderma', productType: 'makeup_remover' });
export const CLEANSER = makeProduct({ id: 'p-cleanser', name: 'Gentle Foam Cleanser', brand: 'CeraVe', productType: 'cleanser' });
export const CLEANSER_B = makeProduct({ id: 'p-cleanser-b', name: 'Second Cleanser', brand: 'La Roche-Posay', productType: 'cleanser' });
export const PEELING = makeProduct({ id: 'p-peeling', name: 'AHA Peeling Solution', brand: 'The Ordinary', productType: 'peeling', activeTags: ['aha'] });
export const TONER = makeProduct({ id: 'p-toner', name: 'Hydrating Toner', brand: 'Klairs', productType: 'toner' });
export const EYE_CREAM = makeProduct({ id: 'p-eye-cream', name: 'Eye Repair Cream', brand: 'Kiehl\'s', productType: 'eye_cream', zones: ['eyes'] });
export const MASK = makeProduct({ id: 'p-mask', name: 'Overnight Sleeping Mask', brand: 'Laneige', productType: 'mask' });
export const FACE_CREAM = makeProduct({ id: 'p-face-cream', name: 'Barrier Repair Cream', brand: 'Aveeno', productType: 'cream' });
export const NECK_CREAM = makeProduct({ id: 'p-neck-cream', name: 'Firming Neck Cream', brand: 'Elemis', productType: 'cream', zones: ['neck'] });
export const OIL_SEAL = makeProduct({ id: 'p-oil', name: 'Face Sealing Oil', brand: 'Biossance', productType: 'oil' });
export const SPF_CREAM = makeProduct({ id: 'p-spf-cream', name: 'Daily Defense SPF50', brand: 'La Roche-Posay', productType: 'spf', activeTags: ['spf_filters'] });
export const SPF_STICK = makeProduct({
  id: 'p-spf-stick',
  name: 'Reapply SPF Stick',
  brand: 'Supergoop',
  productType: 'spf',
  activeTags: ['spf_filters'],
  timing: 'reapply' as StepTiming,
  reapplyAfterHours: 2,
});

// ─── Active-class fixtures for the transition table (PRD_Spec.md §5.3) ──────

export const RETINOID_TREATMENT = makeProduct({ id: 'p-retinoid', name: 'Retinal Serum', brand: 'Medik8', productType: 'serum', activeTags: ['retinoid'] });
export const BPO_TREATMENT = makeProduct({ id: 'p-bpo', name: 'Benzoyl Peroxide Gel', brand: 'PanOxyl', productType: 'gel', activeTags: ['benzoyl_peroxide'] });
export const HYALURONIC_SERUM = makeProduct({ id: 'p-hyaluronic', name: 'Hyaluronic Acid Serum', brand: 'The Ordinary', productType: 'serum', activeTags: ['hyaluronic_acid'] });
export const ACID_TONER = makeProduct({ id: 'p-acid-toner', name: 'Glycolic Toning Solution', brand: 'Pixi', productType: 'toner', activeTags: ['aha'] });
export const VITAMIN_C_SERUM = makeProduct({ id: 'p-vit-c', name: 'Pure Vitamin C Serum', brand: 'SkinCeuticals', productType: 'serum', activeTags: ['vitamin_c_pure'] });
export const PLAIN_MOISTURIZER = makeProduct({ id: 'p-plain-moisturizer', name: 'Daily Moisturizer', brand: 'CeraVe', productType: 'moisturizer' });

// ─── Zone factories ────────────────────────────────────────────────────────────

export function withZones(product: Product, zones: Zone[]): Product {
  return { ...product, zones };
}

// ─── Component prop factories ──────────────────────────────────────────────────

export function makeStepGroupHeaderProps(overrides: Partial<StepGroupHeaderProps> = {}): StepGroupHeaderProps {
  return {
    ordinal: 1,
    action: 'cleanse' as StepAction,
    allCompleted: false,
    editMode: false,
    ...overrides,
  };
}

export function makeRoutineProductCardProps(overrides: Partial<RoutineProductCardProps> = {}): RoutineProductCardProps {
  return {
    product: FACE_CREAM,
    completed: false,
    editMode: false,
    tappable: true,
    onToggleComplete: () => {},
    onOpenActionSheet: () => {},
    onPausePress: () => {},
    onSchedulePress: () => {},
    conflictingProductName: null,
    similarProductName: null,
    adaptationWeek: null,
    ...overrides,
  };
}

export function makeStepTransitionDividerProps(
  overrides: Partial<StepTransitionDividerProps> = {},
): StepTransitionDividerProps {
  return {
    transition: { kind: 'none' } as StepTransition,
    ...overrides,
  };
}

export function makeGapCardProps(overrides: Partial<GapCardProps> = {}): GapCardProps {
  return {
    label: 'SPF',
    onFindInCatalog: () => {},
    ...overrides,
  };
}

export function makeOrphanedSlotCardProps(overrides: Partial<OrphanedSlotCardProps> = {}): OrphanedSlotCardProps {
  return {
    onAddFromCatalog: () => {},
    onPause: () => {},
    ...overrides,
  };
}

// ─── Misc ───────────────────────────────────────────────────────────────────────

export type { ProductType };
