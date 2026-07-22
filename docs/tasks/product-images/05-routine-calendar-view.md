# Task 05 — Routine Calendar View (Month Matrix)

**Depends on:** Task 03 (list view restructure done; the list/calendar toggle
exists in the routine screen sub-header).

## Concept

Switching the existing toggle to "calendar" replaces the accordion list with a
**month matrix**:

- **Rows** = products that appear in the routine (any period, any day).
- **Columns** = days of the current month, horizontally scrollable. Column
  header: weekday abbreviation over date number (e.g. `Sat` / `27`).
- **Left column** (product identity) is **frozen** — it stays put while day
  columns scroll horizontally.
- **Cell** at (product, day) is a square split by a diagonal from top-right to
  bottom-left: **upper-left triangle = AM**, **lower-right triangle = PM**.
  A triangle is filled when that product is scheduled for that day in that
  period; otherwise it stays empty (hairline diagonal visible only when at
  least one half is filled — an entirely unscheduled cell renders as a plain
  empty cell with a subtle border, no diagonal noise).

This is a read-only overview in v1 — no editing from the grid.

## Locked decisions

- **Fill color: Cobalt** (`#1E3A8A` family from tokens) for BOTH triangles —
  per the palette rule "calendar grids = Cobalt (informational)". AM vs PM is
  distinguished by triangle position only, not by color. Use a slightly
  lighter cobalt tint if full value is too heavy at cell size — but one color,
  from tokens.
- Hidden steps (`step.hidden`) are excluded. Steps whose product was deleted
  (dangling `productId`) are excluded.
- **Row identity cell:** 44 px `ProductThumbnail` (from task 02) + brand/name
  stacked, single-line each with ellipsis. Fixed left-column width (~140–160 px,
  pick once, token-derived spacing).
- **Today** column: highlighted header (e.g. filled date badge, monochrome per
  DS) and on first mount the horizontal scroll auto-positions so today is
  visible (roughly left-third of the viewport).
- Month navigation v1: **current month only** — no prev/next month paging yet
  (routines are weekly-recurring, so other months show the same pattern;
  paging adds nothing until procedures/history overlay on this grid). Show the
  month name in the sub-header area.
- Cells are not pressable in v1 except: tapping a **row's identity cell**
  opens the same bottom sheet as task 03 (details / edit / remove / hide).
- Performance: the grid is at most ~30 rows × 31 columns of tiny pure views.
  Render day columns inside one horizontal `ScrollView` (no virtualization
  needed at this scale), rows as plain views. Triangles via two absolutely
  positioned half-views with a transform/border technique or a tiny inline
  SVG — pick the cheapest that renders crisply on both platforms; NO
  per-cell state, cells are pure functions of (step schedule, day).

## Steps

1. **Investigate:** how the list/calendar toggle currently switches content;
   where weekday scheduling lives on `RoutineStep` (`days[]`,
   `'every'` semantics) and reuse the exact same day-resolution helper the
   Today checklist uses (do not re-implement schedule interpretation — extract
   a shared pure util if the logic is currently inline).
2. **Frozen-column mechanics:** React Native has no sticky columns in a
   horizontal scroll. Implement as: fixed-width left column (vertical
   ScrollView A) + horizontally scrollable grid (vertical ScrollView B inside
   a horizontal ScrollView), with **synchronized vertical scroll** between A
   and B via `onScroll` + `scrollTo` (or a shared Animated value). Investigate
   whether the app already uses `react-native-gesture-handler`/Reanimated
   (likely yes, via draggable-flatlist) and prefer the smoothest approach
   available without new deps. If sync jitter is unacceptable in Expo Go,
   fall back to: whole grid (rows incl. identity cells) in ONE vertical
   ScrollView whose rows each contain the frozen cell + a horizontally
   synced segment — document whichever is chosen.
3. **Build the pure layer first:** `buildCalendarMatrix(routines, products,
   month): { rows: [{ product, cells: [{ am: boolean, pm: boolean }] }] }`
   as a pure util with unit tests (specific-days schedules, `every`, hidden
   steps excluded, dangling products excluded, month lengths incl. leap Feb).
4. **Components:** `RoutineCalendarView` (screen-level container),
   `CalendarDayHeaderRow`, `CalendarProductRow`, `CalendarCell` (pure,
   memoized). Tokens only; cell size ~34–40 px square with hairline
   `zinc200` borders.
5. **Empty state:** no scheduled steps → DS empty state with a CTA to add a
   product (same "+" flow as the header).
6. **Tests:** the matrix builder (main coverage), snapshot/render test for a
   small grid, today-highlight logic.

## Acceptance

- Toggle switches list ⇄ calendar; calendar shows the current month with
  frozen product column, synced vertical scrolling, today visible on mount.
- Diagonal AM/PM fills exactly match what the Today checklist would show for
  each date (spot-verify: pick 3 dates, compare against the list view's
  filtering — same shared util guarantees it).
- Smooth scroll on a mid-range device with ~15 products (manual QA checkbox
  in PROGRESS.md).
- `npx tsc --noEmit` clean; tests green.

## Out of scope

Editing from the grid, multi-month paging, procedure/PAO overlays on the
calendar (future ideas — note them in PROGRESS.md as follow-ups).
