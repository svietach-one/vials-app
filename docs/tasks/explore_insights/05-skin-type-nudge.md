# 05 — Stop rendering nothing when the profile has no skin type

**Depends on:** nothing
**Size:** XS
**User-visible change:** yes, for every user who has not completed their skin profile.

---

## Context

`SkinTypeCautionNotice` (`src/components/catalog/SkinTypeCautionNotice.tsx:29`) returns `null` when `caution === null` **or** when `skinType === null`. The second case is the problem: a user who has not set a skin type — which includes most first-time users — gets no card, no message, and no hint that a card exists at all. The screen silently offers less to exactly the people who have given us the least, and never tells them the trade.

The first case (`caution === null` with a skin type set) is correct behaviour and must stay silent: no caution means there is nothing to say.

---

## Change

In `SkinTypeCautionNotice.tsx`, split the two null branches:

- `caution === null` **and** `skinType !== null` → render nothing. Unchanged.
- `caution !== null` **and** `skinType === null` → render a nudge instead of nothing.
- `caution === null` **and** `skinType === null` → render nothing. We do not know there is anything to say, so promising insight would be a lie.

Nudge copy, exactly:

> `Set your skin type to see how these ingredients suit you`

with a text-link action `Set skin type` that navigates to the profile editor — `ProfileScreen` opens `SkinProfileEditModal` via the Edit button at `ProfileScreen.tsx:286-289`. Navigate to the Profile tab; do not try to open the modal directly from this screen unless a param already exists for it, and do not add one for this task.

Style it as a muted informational row consistent with the surrounding cards. `palette.cobalt` per the informational mapping. Not amber, not cabernet — the user has done nothing wrong.

---

## Acceptance criteria

- Caution present + skin type null → nudge renders, with a working navigation action.
- Caution present + skin type set → existing caution string renders, unchanged.
- No caution + skin type set → nothing renders.
- No caution + no skin type → nothing renders.
- The existing caution string is not modified.
- `npm test` green, `npx tsc --noEmit` clean.

## Tests

Extend the existing test for this component (create `SkinTypeCautionNotice.test.tsx` if absent) with one case per branch above — all four, including both nothing-renders cases.

## Out of scope

- Changing `buildSkinTypeCaution` logic.
- Adding a route param to open `SkinProfileEditModal` directly.
- Any other empty state on the screen.
