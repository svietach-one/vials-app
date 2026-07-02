# Product Shelf Card
Date: 2026-06-29
Author: planner-agent
Status: APPROVED

## AI-SDLC Flags
```
backend_layer:   false
frontend_layer:  true
infra_changes:   false
```

---

## 1. Problem Statement

The product catalog (virtual shelf) currently lacks a purpose-built card component. Cards must simultaneously convey routine membership status, time-of-day usage, ingredient highlights, and offer fast contextual actions — all within a compact list item. Without a dedicated component, the shelf screen cannot be built without ad-hoc, inconsistent markup that diverges from the established RoutineStepCard visual language.

---

## 2. Goals

- Provide a single, reusable `ProductShelfCard` component that renders one product per card in the catalog list.
- Display two mutually exclusive visibility states: product is in a routine (schedule + time-of-day icons) vs. product is hidden or unscheduled (eye-off label).
- Surface type badge and active-ingredient badge inline at the bottom-left, with an overflow menu at the bottom-right.
- Whole-card tap navigates to `ProductDetailScreen`; overflow tap opens a contextual action sheet without triggering navigation.
- Reuse existing design tokens, icon set, and badge styles verbatim — no new design primitives.

---

## 3. Non-Goals

- The card does not show conflict warnings (conflict warnings are exclusive to the routine view per CLAUDE.md).
- The card does not handle drag-and-drop reordering.
- The card does not render a product image thumbnail in Phase 1.
- The overflow sheet does not handle Hide/Show toggling — that remains the existing `ProductActionSheet` concern; the shelf card replaces that action with Add/Remove from routine.
- The component does not fetch or store data; all data is received via props.

---

## 4. User Stories

### Story 1: Routine-member product display
As a user browsing my shelf, I want to see which days and time of day I use each product, so that I can quickly assess my routine coverage at a glance.

**Acceptance Criteria:**
- [ ] Given a product whose `productId` appears in at least one `RoutineStep`, when the shelf card renders, then the middle row shows a calendar icon followed by the formatted day label (e.g., "Mon • Wed • Sat" or "Every day").
- [ ] Given a product with `usageTime: 'morning'`, when the card renders in routine state, then only the sun icon appears in the right slot of the middle row.
- [ ] Given a product with `usageTime: 'evening'`, when the card renders in routine state, then only the moon icon appears.
- [ ] Given a product with `usageTime: 'both'`, when the card renders in routine state, then both moon and sun icons appear.
- [ ] Given a product in a routine, when the card renders, then the "Hidden from routine" label is NOT shown.

### Story 2: Non-routine product display
As a user, I want to immediately identify products that are not part of any routine, so that I can decide to add them or remove them from my shelf.

**Acceptance Criteria:**
- [ ] Given a product with `isHidden: true`, when the card renders, then the middle row shows an eye-off icon followed by the text "Hidden from routine" in `textTertiary` color.
- [ ] Given a product with no matching `RoutineStep`, when the card renders, then the same "Hidden from routine" state is shown.
- [ ] Given a product not in a routine, when the card renders, then no calendar icon or day label is shown.

### Story 3: Badge row
As a user, I want to see the product type and key active ingredient at a glance, so that I can filter and compare products without opening the detail screen.

**Acceptance Criteria:**
- [ ] Given any product, when the card renders, then a type badge appears in the bottom-left using the `TYPE_COLORS` mapping (cobalt/bottleGreen/amber tint per type group, zinc fallback for unmapped types).
- [ ] Given a product with at least one entry in `activeTags` or `activeIngredients`, when the card renders, then an outlined active-ingredient badge appears to the left of the type badge.
- [ ] Given a product with neither `activeTags` nor `activeIngredients`, when the card renders, then only the type badge appears.
- [ ] Given both badges are present and text is long, when the card renders, then neither badge wraps to a second line; each uses `numberOfLines={1}` truncation with `flexShrink`.

### Story 4: Overflow menu actions
As a user, I want context-sensitive actions from the card overflow menu, so that I can manage products without navigating away from the shelf.

**Acceptance Criteria:**
- [ ] Given any product card, when the user taps the overflow button (`more-vertical`), then an action sheet opens.
- [ ] Given a product in a routine, when the action sheet opens, then the second action reads "Remove from routine" and triggers `onRemoveFromRoutine`.
- [ ] Given a product not in a routine, when the action sheet opens, then the second action reads "Add to routine" and triggers `onAddToRoutine`.
- [ ] Given the user taps the overflow button, when the sheet opens, then the card-level `onCardPress` handler is NOT called (event does not propagate).
- [ ] Given the action sheet is open, when the user taps Cancel or the backdrop, then the sheet closes and no action is triggered.
- [ ] Given the user taps Delete in the action sheet, then the action is styled destructively (existing behavior from `ProductActionSheet`).

### Story 5: Pressed and disabled states
As a user, I want tactile feedback when interacting with cards, so that the interface feels responsive.

**Acceptance Criteria:**
- [ ] Given the user presses the card body, when holding down, then the card background changes to `colors.bgSubtle`.
- [ ] Given `disabled` prop is true, when the card renders, then the entire card renders at `opacity: 0.4` and taps are ignored.

---

## 5. UX / Behaviour

**Card layout (top to bottom):**
1. Top row — product name (left, `DMSans-Bold`, `body`, truncated) + brand name (right, `bodySmall`, `textSecondary`, truncated).
2. Middle row — one of two mutually exclusive states (routine-member or hidden), described in Stories 1 and 2.
3. Bottom row — badge row (left, horizontal, non-wrapping) + overflow `IconButton` (bottom-right, `ghost`, `sm`).

**Overflow tap isolation:** The `more-vertical` `IconButton` must call `event.stopPropagation()` (via `onPress` with the native event) so tapping it never fires `onCardPress`.

**Card dimensions:** Match `RoutineStepCard` exactly — `paddingHorizontal: space[4]`, `paddingVertical: space[4]`, `borderRadius: radius.xl`, `borderWidth: 1`, `borderColor: palette.zinc200`, `backgroundColor: palette.white`.

**Accessibility:** The card `Pressable` carries `accessibilityRole="button"` and `accessibilityLabel` of "{product.name}, tap to view details". The overflow button carries `label="More actions for {product.name}"`.

---

## 6. Data Requirements

- Existing data consumed: `Product` (all fields), `RoutineStep` (to derive routine membership).
- New data required: none. All data is derived from existing stores.
- The component is stateless; the parent computes `isInRoutine`, `scheduleLabel`, and `usageTime` and passes them as props.

---

## 7. Dependencies

- Depends on: `RoutineStepCard` visual language (badge styles, schedule row styles copied verbatim).
- Depends on: `ProductActionSheet` (extended with optional routine-action props).
- Depends on: `formatScheduleDays` from `@/utils/routineLabel`.
- Depends on: `ACTIVE_INGREDIENT_LABELS`, `PRODUCT_TYPE_LABELS` from `@/constants/labels`.
- Depends on: `IconButton` (`ghost`, `sm`) from `@/components/ui/core/IconButton`.
- Blocks: any screen that renders the product catalog list (e.g., CatalogScreen) using this card component.

---

## 8. Security & Privacy

- Authentication required: no (local-only storage, Phase 1).
- Data sensitivity: none beyond standard local product data.
- Compliance: not applicable (Phase 1, no network data).

---

## 9. Success Metrics

- The shelf list renders cards that are visually indistinguishable in density and style from `RoutineStepCard` (design consistency verified by visual review).
- Zero instances of the card triggering navigation when the overflow button is tapped (verifiable by QA interaction test).
- All badge texts truncate without layout overflow at any product name length (verifiable by snapshot test with extreme-length strings).

---

## 10. Open Questions

- No open questions. All design decisions have been resolved in the Technical Design document.
