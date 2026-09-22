/**
 * Fixtures for the day-split-alternation QA suite (qa-lead).
 *
 * Spec:        docs/specs/day-split-alternation.md
 * Tech design: docs/tech-design/day-split-alternation.md
 *
 * The tech design leaves exact UI prop names/shapes for FE-5 (Draft Preview
 * prompt card) unspecified beyond "two new optional callback props on
 * DraftPreviewScreenProps, mirroring the existing onOverride prop" — per the
 * established precedent in tests/routine-similar-product-priority/fixtures.ts
 * and tests/clinic-forecast-timeline/fixtures.ts, this header is the BINDING
 * CONTRACT qa-lead picked; engineer implements FE-5/FE-6 against it, not a
 * guess.
 *
 * ── New engine-level data (FE-1, planTypes.ts) ────────────────────────────
 *   `ReserveItem` gains two new OPTIONAL fields:
 *     rivalOfProductId?: string  — the admitted winner this reserved product
 *                                   lost to (present only when reasonCode is
 *                                   'cycle_class_rival').
 *     period?: Period            — 'am' | 'pm', the period the rivalry was
 *                                   detected in (always 'pm' for the one live
 *                                   pairing today — retinoid/aha/bha are all
 *                                   PM-only).
 *   New `DecisionReasonCode` member: 'cycle_class_rival'.
 *   These fields do not exist yet — every fixture/assertion below that reads
 *   or constructs them is EXPECTED TO FAIL `tsc --noEmit` until FE-1 ships,
 *   the same "intended drift signal" pattern documented in
 *   tests/routine-similar-product-priority/fixtures.ts for `slotAlternatives`.
 *
 * ── DraftPreviewScreen prompt card (Story 2/3/4, FE-5) ────────────────────
 *   Two new optional props on DraftPreviewScreenProps, mirroring `onOverride`:
 *     onAcceptCycleSplit?: (rivalProductId: string) => void
 *       — fired when "Alternate automatically" is tapped.
 *     onDeclineCycleSplit?: (rivalProductId: string) => void
 *       — fired when "Keep only [winner name]" is tapped.
 *   One new optional prop for session-scoped suppression (Story 4 AC: "the
 *   prompt does not render again for this pair within the same Draft Preview
 *   session"), since declining is a local/ephemeral RoutinesScreen-owned
 *   decision (tech design Assumption 5) with no store write to key off:
 *     dismissedCycleSplitRivalIds?: string[]
 *       — rival productIds RoutinesScreen has locally dismissed this
 *         session; the PROMPT CARD stays hidden for a listed id, but the
 *         product's normal collapsed "In reserve" row (with its own
 *         "Add anyway") is UNCHANGED — decline only suppresses the card, per
 *         spec §5 "Tapping either resolves the card for the current
 *         session".
 *
 *   Rendering contract:
 *   - The card renders when `plan.reserve` contains an item with
 *     `reasonCode === 'cycle_class_rival'` whose `productId` is NOT in
 *     `dismissedCycleSplitRivalIds` (default `[]`). At most one such item is
 *     ever present per plan (tech design Non-Goal: single rival only), so
 *     the card never needs to pick among several.
 *   - It renders directly below the AM/PM step lists and ABOVE the
 *     collapsible "In reserve" section — i.e. its actions are visible WITHOUT
 *     expanding "In reserve" (`reserveExpanded` starts false in
 *     DraftPreviewScreen today; the prompt card sits outside that toggle).
 *   - Visible text names both products; the rival's still-reserved row (once
 *     "In reserve" is expanded) is unaffected and keeps its own "Add anyway"
 *     button (existing `onOverride` path) — the two affordances are
 *     independent, never double-firing.
 *   - Action accessibility labels:
 *       accessibilityLabel="Alternate automatically" (-> onAcceptCycleSplit(item.productId))
 *       accessibilityLabel={`Keep only ${winnerName}`} (-> onDeclineCycleSplit(item.productId))
 *     where `winnerName` is the admitted winner step's product name
 *     (`rivalOfProductId` looked up the same way DraftPreviewScreen already
 *     resolves any other productId -> name, via the `products` store prop).
 *
 * ── RoutinesScreen wiring (Story 3/4, FE-6) ────────────────────────────────
 *   - onAcceptCycleSplit(rivalProductId) calls the SAME
 *     `useTrackingStore.getState().addOverride(rivalProductId, currentOverrideHash())`
 *     phase-07's `handleOverride` already calls, then regenerates the draft
 *     (`setDraft(validateCurrentRoutines())`) — no new store field.
 *   - onDeclineCycleSplit(rivalProductId) only adds `rivalProductId` to a
 *     local, ephemeral `Set<string>` (component state) — no store write, no
 *     regeneration — and that set is threaded into DraftPreviewScreen as
 *     `dismissedCycleSplitRivalIds`.
 */

import type { ActiveIngredientKey, Product, RoutineStep, UserProfile } from '@/types';
import type { EngineInput } from '@/utils/routineEngine/generate';
import type { PlannedStep, ReserveItem } from '@/utils/routineEngine/planTypes';
import type { RoutinePlan } from '@/utils/routineEngine/generate';

// ─── A fixed instant so adaptation/virtual-count math stays deterministic ────

export const NOW = new Date('2026-09-22T12:00:00Z');

// ─── Product factory ──────────────────────────────────────────────────────────

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function resetFixtureCounters(): void {
  idCounter = 0;
}

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

/** The one real pairing this feature targets: a PM-only retinoid vs a PM-only
 *  AHA/BHA exfoliant, both `serum` (native treatment format). */
export const RETINOID = makeProduct({
  id: 'p-retinoid',
  name: 'Retinol Serum',
  activeTags: ['retinoid'] as ActiveIngredientKey[],
  addedAt: '2026-01-01',
});

export const AHA = makeProduct({
  id: 'p-aha',
  name: 'Glycolic Acid Serum',
  activeTags: ['aha'] as ActiveIngredientKey[],
  addedAt: '2026-02-01',
});

export const BHA = makeProduct({
  id: 'p-bha',
  name: 'Salicylic Acid Serum',
  activeTags: ['bha'] as ActiveIngredientKey[],
  addedAt: '2026-01-15',
});

/** A second exfoliant of the SAME losing cycleClass as AHA — for Story 1 AC3
 *  ("only the single best-ranked rival is ever tagged"). Deliberately older
 *  than AHA so the two are distinguishable in fixtures, though the suite
 *  asserts the "exactly one, not both" invariant rather than pinning which
 *  one wins (the tech design does not specify an exact tiebreak formula for
 *  "best-ranked" beyond "today's existing tiebreak order"). */
export const BHA_SECONDARY = makeProduct({
  id: 'p-bha-secondary',
  name: 'Backup Salicylic Toner',
  activeTags: ['bha'] as ActiveIngredientKey[],
  addedAt: '2025-12-01',
});

// ─── EngineInput factory ──────────────────────────────────────────────────────

export function makeEngineInput(
  products: Product[],
  overrides: Partial<EngineInput> = {},
): EngineInput {
  return {
    products,
    procedures: [],
    profile: { fitzpatrick: null, concerns: [] },
    seasonMask: { season: 'spring', source: 'calendar' },
    now: NOW,
    ...overrides,
  };
}

/** `acne` ranks `retinoid` ahead of `bha` (goals.acne =
 *  [retinoid, bha, benzoyl_peroxide, azelaic_acid, niacinamide]) — the
 *  minimal real goal that makes the retinoid the PM treatment winner while
 *  aha/bha remain eligible, irritancy>=3 treatment-pool candidates (strong
 *  carriers enter the treatment pool regardless of ranking membership;
 *  see skeleton.ts classifyEntries). */
export function cycleRivalProfile(
  overrides: Partial<Pick<UserProfile, 'primaryGoal' | 'secondaryGoal' | 'fitzpatrick'>> = {},
): EngineInput['profile'] {
  return { fitzpatrick: null, concerns: [], primaryGoal: 'acne', secondaryGoal: null, ...overrides };
}

// ─── RoutineStep factory (for ConflictWarningInline-facing tests) ────────────

export function makeStep(productId: string, overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: `step-${productId}`,
    productType: 'serum',
    productId,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

/** Projects a resolved PlannedStep into the RoutineStep shape
 *  ConflictWarningInline/RoutinesScreen actually render — the same
 *  per-day-filtered shape RoutinesScreen's `amSteps`/`pmSteps` already are
 *  (RoutinesScreen.tsx `isStepForDay`), which is the real seam Story 5's "no
 *  stale warning" acceptance criterion is about. */
export function stepFromPlanned(planned: PlannedStep): RoutineStep {
  return {
    id: `step-${planned.productId}`,
    productType: planned.productType,
    productId: planned.productId,
    hidden: false,
    scheduledDays: planned.scheduledDays,
  };
}

// ─── RoutinePlan / ReserveItem factories (FE-1 fields — see header) ──────────

export function makePlannedStep(overrides: Partial<PlannedStep> = {}): PlannedStep {
  return {
    productId: RETINOID.id,
    productType: 'serum',
    scheduledDays: [],
    slotIndex: 5,
    score: 0,
    addedAt: '2026-01-01',
    ...overrides,
  };
}

/**
 * A cycle_class_rival ReserveItem — the FE-1 shape a `plan.reserve` entry
 * must carry once skeleton.ts detects a cross-cycleClass rivalry (Story 1
 * AC1). Fields `rivalOfProductId`/`period` and the `cycle_class_rival`
 * reasonCode do not exist on `ReserveItem`/`DecisionReasonCode` yet — see the
 * file header. Kept as a real `ReserveItem`-typed literal (not `any`) so the
 * excess-property/union-mismatch failure is the intended, visible drift
 * signal rather than a silently-passing untyped object.
 */
export function makeCycleRivalReserveItem(overrides: Partial<ReserveItem> = {}): ReserveItem {
  return {
    productId: AHA.id,
    reasonCode: 'cycle_class_rival',
    rivalOfProductId: RETINOID.id,
    period: 'pm',
    ...overrides,
  } as ReserveItem;
}

/**
 * A full RoutinePlan admitting the winner (retinoid) into Evening with the
 * rival (AHA) tagged `cycle_class_rival` in reserve — the exact shape
 * DraftPreviewScreen's new prompt card (FE-5) reads. Uses the strongly-typed
 * `RoutinePlan`/`ReserveItem` so the not-yet-existing FE-1 fields fail `tsc`
 * (the intended drift signal — see file header), not a silent `any`.
 */
export function makePlanWithCycleRival(overrides: Partial<RoutinePlan> = {}): RoutinePlan {
  return {
    rulesetVersion: 'test',
    generatedFor: '2026-09-22',
    periods: {
      morning: [],
      evening: [
        makePlannedStep({ productId: RETINOID.id, productType: 'serum', scheduledDays: [2, 6] }),
      ],
    },
    frozen: [],
    reserve: [makeCycleRivalReserveItem()],
    placeholders: [],
    decisions: [],
    slotAlternatives: [],
    ...overrides,
  };
}
