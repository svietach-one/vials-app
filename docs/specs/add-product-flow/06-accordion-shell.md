# Task 06: Accordion Shell + Save Bar

Depends on: `01-types.md`, `02-form-reducer.md`

## Goal

Create two presentational components:
- `src/components/addProduct/SectionAccordion.tsx`
- `src/components/addProduct/SaveBar.tsx`

Neither of these knows about `AddProductDraft` directly — they're generic,
reusable shells driven entirely by props. All draft-aware logic lives in
the section components (task 07) and the screen (task 08).

## `SectionAccordion.tsx`

```ts
interface SectionAccordionProps {
  index: 1 | 2 | 3 | 4;
  title: string;
  status: 'empty' | 'in-progress' | 'complete' | 'skipped';
  isExpanded: boolean;
  onToggle: () => void;
  summary: React.ReactNode; // rendered in the collapsed row
  children: React.ReactNode; // rendered when expanded
}
```

Behavior:
- Collapsed row shows: a leading status indicator, the section title (or,
  once complete, the `summary` content in place of the title), and a
  trailing icon (chevron when expanded/expandable, edit pencil when
  complete-and-collapsed).
- Status indicator rendering:
  - `empty`: outlined circle with the section number inside
  - `in-progress`: same outlined circle (still shows the number — this
    state exists for the reducer's bookkeeping, it doesn't need a
    distinct visual from `empty`)
  - `complete`: filled circle (`var(--text-primary)` equivalent /
    DS primary token) with a checkmark
  - `skipped`: filled circle with a minus/dash icon (used for Section 2
    when barcode is skipped)
- Tapping the collapsed row (anywhere on it, not just a specific icon)
  calls `onToggle()`. This is the sole mechanism for re-editing a
  completed section — there is no separate "Back" navigation anywhere in
  this flow.
- Only one section is expanded at a time across the whole screen — this
  screen-level constraint is enforced by the parent (task 08) via a single
  `expandedSection` value in the reducer, not by this component.

## `SaveBar.tsx`

```ts
interface SaveBarProps {
  enabled: boolean;
  onPress: () => void;
  privacyNote?: string; // optional, defaults to standard copy if omitted
}
```

- Anchored to the bottom of the screen as a normal sibling view outside
  the scroll container (`paddingBottom: insets.bottom` from safe-area,
  not `position: fixed` / absolute positioning tricks).
- Default privacy note: "Only brand, name, category, and ingredients are
  shared. Dates stay private." — skip rendering this if the screen already
  shows an equivalent note in Section 4 (task 07 decides which one wins;
  don't duplicate it).
- Primary button, label **"Save and put on shelf"**. This is the one
  primary-filled action on the entire screen — every other interactive
  element in this flow (pills, tiles, skip buttons) must use a
  secondary/outline treatment, not primary-filled, to preserve that
  single-accent convention.
- **The button is never rendered in a visually-disabled/low-contrast
  state**, even when `enabled` is false. When `enabled` is false and the
  user taps it, `onPress` should still fire — but the screen-level handler
  (task 08) is responsible for showing inline validation and
  auto-expanding the first incomplete required section rather than this
  component silently no-op-ing. `SaveBar` itself doesn't know why it's
  "not ready"; it just always looks tappable and always calls `onPress`.

## Done when

- `SectionAccordion` renders all four status variants correctly and
  collapses/expands purely from props (no internal state beyond animation
  timing, if any).
- `SaveBar` looks identical whether `enabled` is true or false, and always
  fires `onPress`.
- Neither file imports `AddProductDraft`, `FormAction`, or anything from
  `formReducer.ts` — keep them decoupled from the specific feature they
  happen to be used in.
