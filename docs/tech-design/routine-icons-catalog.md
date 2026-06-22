# Technical Design: Routine Status Icons on Catalog Cards
Spec: docs/specs/routine-icons-catalog.md
Author: planner-agent
Date: 2026-06-22

## 1. Architecture Overview

Single-screen change. `CatalogScreen` adds one new store selector and delegates
status computation to a new pure utility. A new `RoutineBadge` sub-component
renders inside the existing `nameRow` flex row.

```
CatalogScreen
  ├── useRoutinesStore(s => s.routines)   ← new selector
  └── renderItem({ item })
        └── cardContent > nameRow (flexDirection: row, nowrap)
              ├── productName (flexShrink: 1)
              ├── Tag (type label)          ← existing
              └── RoutineBadge              ← new, null when status='none'

cardInner (row) — outside nameRow:
  └── IconButton (three-dot)              ← unchanged, sibling of cardContent

New util: src/utils/routineStatus.ts
  └── getProductRoutineStatus(productId, routines) → RoutineStatusResult
```

No new screens, navigators, or store actions. No changes to `routinesStore`.

---

## 2. API Contracts

N/A — no API endpoints. No new store actions or navigation routes.

**New exported types (routineStatus.ts):**
```ts
export type RoutineStatusResult = 'morning' | 'evening' | 'both' | 'none';
```

---

## 3. Implementation Tasks

### engineer (scope=frontend)

- FE-1: Create `src/utils/routineStatus.ts`
  - Export `RoutineStatusResult` type.
  - Export pure function `getProductRoutineStatus(productId: string, routines: Routine[]): RoutineStatusResult`.
  - Logic: filter routines by `timeOfDay`; for each, check if any step has `productId === productId && !s.hidden`. Combine into four-value union.
  - Files: `src/utils/routineStatus.ts`

- FE-2: Add `RoutineBadge` sub-component to `CatalogScreen.tsx`
  - Private (not exported) function component `RoutineBadge({ status }: { status: RoutineStatusResult })`.
  - Returns `null` when `status === 'none'`.
  - Renders a `View` with `badgeStyles.pill` (solid `colors.borderDivider` background, `flexDirection: 'row'`, `gap: 3`, `paddingHorizontal: space[2]`, `paddingVertical: 3`, `borderRadius: 99`). No `opacity` on the View.
  - Inside: Feather `sun` (size 13, `colors.textSecondary`) when morning, Feather `moon` (size 13, `colors.textSecondary`) when evening, both when both.
  - Files: `src/screens/CatalogScreen.tsx`

- FE-3: Wire `RoutineBadge` into `CatalogScreen`
  - Add `const routines = useRoutinesStore(s => s.routines)` selector.
  - In `renderItem`, compute `const routineStatus = getProductRoutineStatus(item.id, routines)`.
  - Insert `<RoutineBadge status={routineStatus} />` as the last child of `nameRow` (after `Tag`).
  - Add `badgeStyles` StyleSheet alongside existing `styles`.
  - Files: `src/screens/CatalogScreen.tsx`

### engineer (unit tests)

- UT-1: Create `src/utils/routineStatus.test.ts`
  - Test all four return values with minimal `Routine[]` fixtures.
  - Test that `hidden: true` steps are treated as absent.
  - Test that `null` productId steps are treated as absent.
  - Files: `src/utils/routineStatus.test.ts`

---

## 4. Assumptions

- Badge is placed as last child of `nameRow` (not absolutely positioned).
  Alternative: absolute overlay on a `position: 'relative'` card wrapper.
  Reason: The card has no image area. Inline placement avoids z-index complexity
  and naturally pushes the product name to shrink — `flexShrink: 1` already set.

- Icon color is `colors.textSecondary` (zinc500) — muted, not accent.
  Alternative: use `colors.statusSafe` (bottleGreen) for a "scheduled/active" semantic.
  Reason: The badge is metadata, not a status alert. Muted treatment avoids visual
  competition with the `Tag` component which already communicates product type.

- Pill background uses `colors.borderDivider` (zinc200) — solid, no opacity.
  Alternative: `colors.bgSubtle` (zinc50) with opacity.
  Reason: `surfaceCard` is `bone` (#FAF9F6); zinc50 (#FAFAFA) provides near-zero
  contrast. zinc200 (#E4E4E7) is visually distinct. Solid color avoids React Native
  `opacity` cascading onto child icons.

- Hidden steps (`hidden: true`) are excluded from the badge.
  Alternative: count hidden steps as active.
  Reason: A hidden step means the user suppressed that product from the routine
  view; treating it as inactive in the badge matches the user's intent.

---

## 5. Open Questions

No open questions — all decisions resolved in assumptions above.
