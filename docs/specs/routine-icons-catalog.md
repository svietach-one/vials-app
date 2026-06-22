# Routine Status Icons on Catalog Cards
Date: 2026-06-22
Author: planner-agent
Status: DESIGNED

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

---

## 1. Problem Statement

Users have no way to see at a glance which products are already scheduled in their Morning or Evening routines while browsing the catalog. They must open each product's detail page to find out. This creates friction when building or reviewing routines and makes the catalog feel disconnected from the scheduling system.

---

## 2. Goals

- Each product card in the catalog shows a compact routine-status badge in its top-right area when the product is active in one or both routines.
- Morning-only: Feather `sun` icon. Evening-only: Feather `moon` icon. Both: `sun` + `moon` side-by-side. Not in any routine: nothing rendered.
- Icons feel integrated (semi-transparent pill background, design-system colors) without obscuring product name or brand.
- No performance regression — store selection is done with a single shallow selector; badge is rendered only when status is not `'none'`.

---

## 3. Non-Goals

- No changes to `RoutinesScreen`, `ProductDetailScreen`, or any routine store actions.
- No changes to `productsStore`.
- No changes to card press behavior or the three-dot action sheet.
- No tooltip or interactive behavior on the badge — it is display-only.

---

## 4. User Stories

### Story 1: Morning-only product shows sun icon
As a user browsing my catalog, when a product is assigned to my Morning routine only, then I see a small sun icon in the top-right of that card.

**Acceptance Criteria:**
- Given a product has a non-hidden step in the Morning routine and no step in the Evening routine, when the catalog renders, then the card shows exactly one `sun` icon badge and no `moon` icon.

### Story 2: Evening-only product shows moon icon
As a user browsing my catalog, when a product is assigned to my Evening routine only, then I see a small moon icon in the top-right of that card.

**Acceptance Criteria:**
- Given a product has a non-hidden step in the Evening routine and no step in the Morning routine, when the catalog renders, then the card shows exactly one `moon` icon badge and no `sun` icon.

### Story 3: Both-routine product shows sun + moon
As a user browsing my catalog, when a product is in both routines, then I see both a sun and a moon icon side-by-side on that card.

**Acceptance Criteria:**
- Given a product has non-hidden steps in both Morning and Evening routines, when the catalog renders, then both icons are rendered left-to-right: sun first, moon second.

### Story 4: Unassigned product shows no badge
As a user browsing my catalog, when a product is not in any routine (or all its steps are hidden), then its card has no routine badge at all — no empty space artifact.

**Acceptance Criteria:**
- Given a product has no steps in any routine, when the catalog renders, then no badge element is rendered on the card.
- Given a product's step has `hidden: true`, it is treated the same as absent.

---

## 5. UX / Behaviour

**Badge placement:** Right-aligned inside the `nameRow` — after the product type `Tag`, before the three-dot `IconButton` (which is in the outer `cardInner` flex row). The badge slots in as the last child of `nameRow`.

**Badge anatomy:** A small `View` with a solid `borderDivider` (zinc200) pill background containing 1–2 `Feather` icons at size 13. Icon color: `textSecondary` (`zinc500`) — muted so it reads as metadata, not an alert.

**Hidden steps:** A step with `hidden: true` counts as absent. The badge only reflects steps where `hidden !== true`.

**Store access:** `CatalogScreen` already uses `useProductsStore`. It will additionally subscribe to `useRoutinesStore` with a single shallow-selected `routines` array. A pure utility `getProductRoutineStatus(productId, routines)` computes the status — called once per rendered card inside `renderItem`.

---

## 6. Data Requirements

- No new store fields, actions, or AsyncStorage keys.
- One new pure utility: `src/utils/routineStatus.ts` — `getProductRoutineStatus(productId, routines): RoutineStatusResult`.
- `RoutineStatusResult = 'morning' | 'evening' | 'both' | 'none'` — exported type.

---

## 7. Dependencies

- Depends on: `routinesStore` being hydrated (already guaranteed by `AppNavigator` on app start).
- Depends on: Feather icon set from `@expo/vector-icons` (already installed and used in `CatalogScreen`).
- Blocks: nothing downstream.

---

## 8. Security & Privacy

No PII involved. Local-only data. No security implications.

---

## 9. Success Metrics

- Zero TypeScript compilation errors after changes.
- Product cards in the catalog accurately reflect routine membership for all four states (morning / evening / both / none).
- No visible layout shift or overflow on the name row when badge is present.

---

## 10. Open Questions

None. All decisions resolved.
