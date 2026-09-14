# Explore Composition — Detected Actives: "What Order Means" Info Tooltip
Date: 2026-09-14
Author: planner-agent
Jira: N/A (kebab-case task slugs only — see `.claude/rules/agent-layer-protocol.md` §1)
Status: DRAFT

## AI-SDLC flags
- `backend_layer`: false — this app is frontend-only (Expo/React Native, local storage, no server
  component owned by this repo), same convention as `docs/specs/explore-composition.md`.
- `frontend_layer`: true
- `infra_changes`: false

## 1. Problem Statement
`DetectedActivesCard` (`src/components/catalog/DetectedActivesCard.tsx`) already shows, for each
detected active, its ordinal position in the ingredient list ("6th of 42") and, when applicable, a
"Below the 1% line — likely a small amount" note (shipped by the prior `explore-insights-v2` batch,
`docs/tasks/explore_insights/01-03`, git `47ad52c`/`1235824`/`1fbd528`/`1694419`). Neither piece of
information is explained anywhere on screen — a user sees "6th of 42" with no context for why
position matters or what "the 1% line" means. Reported directly by the product owner: the Detected
Actives block needs some explanation — e.g. an icon with a tap-triggered tooltip — of what an
ingredient's list position means and what it affects.

## 2. Goals
- A user viewing `DetectedActivesCard` has a discoverable, optional way (an icon, tapped) to read a
  plain-language explanation of what INCI ordering means and what the 1% line represents.
- The explanation is general and educational — it describes the labeling convention, not a
  personalized or measured claim about this specific scanned product.
- The same explanation is available wherever `DetectedActivesCard` renders
  (`ExploreCompositionResultScreen.tsx` and `WishlistEntryDetailScreen.tsx`) with zero
  screen-specific code, since it's a self-contained addition to the shared component.

## 3. Non-Goals
- No new ingredient-position data, parsing, or plumbing of any kind — `src/utils/productProfile/
  resolve.ts`, `ingredientParser.ts`, and `onePercentLine.ts` are unchanged; the position/1%-line
  data this tooltip explains already exists and already renders on the card (`explore-insights-v2`
  task 03).
- No per-row / per-ingredient detail sheet — task 03's own "Out of scope" section already named this
  ("Making the rows tappable / an ingredient detail sheet. Later batch.") and it stays deferred; this
  task adds exactly one card-level info trigger, not one per row.
- No % match, efficacy score, or other invented number — the tooltip explains the existing
  convention only, and explicitly states it is not a measured value for this specific product.
- No rewording of the card's existing copy ("Detected actives", "{n} ingredients in this list",
  "{ordinal} of {n}", the below-the-line note strings) — this task only adds a new trigger +
  tooltip, it does not touch any existing string.

## 4. User Stories

### Story 1: Understand what ingredient position means
As a user viewing the Detected Actives card, I want to tap an info affordance and read what an
ingredient's list position and the "1% line" mean, so the numbers I'm already looking at make sense.

**Acceptance Criteria:**
- [ ] Given the Detected Actives card header, when it renders, then an info icon sits next to the
      "Detected actives" title, always visible regardless of whether any rows show a position.
- [ ] Given the info icon, when tapped, then a tooltip/sheet opens showing a title and body
      explaining the INCI-ordering convention and the 1% line, using the copy in §5.
- [ ] Given the tooltip is open, when the user taps its close control or its backdrop, then it
      closes, returning to the card underneath — same interaction contract as
      `AttributionTooltip.tsx`.
- [ ] Given the tooltip's copy, when read, then it explicitly states this is a general labeling
      convention, not a measured percentage for this specific product — no claim more specific than
      what the underlying data already supports.
- [ ] Given the card renders on `WishlistEntryDetailScreen.tsx` instead of
      `ExploreCompositionResultScreen.tsx`, when the icon is tapped, then the exact same tooltip
      renders — verifying no screen-specific wiring was introduced.

## 5. UX / Behaviour
Icon: `Icon name="info"` (this app's established informational glyph — 9 existing call sites, e.g.
`ProductDetailScreen.tsx`, `GapCard.tsx`), wrapped in an `IconButton` (`variant="ghost"`,
`size="sm"`, matching `AttributionTooltip.tsx`'s own close-button usage), placed inline after the
"Detected actives" title text inside `DetectedActivesCard.tsx`'s `cardHeaderText` block. Trigger:
local `useState` boolean + `IconButton.onPress`, `accessibilityRole="button"`, a descriptive
`accessibilityLabel` (e.g. "What ingredient order means"), and a `testID`
(`detected-actives-info-icon`) — same convention `RoutineStepCard.tsx` already uses to open
`AttributionTooltip`.

Tooltip: new `InfoTooltip` component (see tech design), visually identical to
`AttributionTooltip.tsx`'s shell (backdrop + slide-up bottom card + header + close `IconButton`),
but with a static `title`/`body` instead of per-match content.

Copy (marked `PLACEHOLDER — pending design review`, same convention `docs/specs/
explore-composition.md` used for Story 7's caution sentence before it was finalized):

- Title: **"What ingredient order means"**
- Body: **"Ingredient lists are conventionally ordered by concentration, from highest to lowest —
  the ingredients at the top of the list are typically present in the largest amounts, and amounts
  generally decrease further down. This ordering is only reliable down to about the 1% mark; below
  that line, brands can list ingredients in any order, so position alone can't meaningfully rank the
  smallest amounts. In practice, this means an active near the top of a label is more likely to be
  at a working concentration, while one further down — especially below the 1% mark — may be
  present in a smaller, sometimes cosmetic amount. This explains the general labeling convention
  only; it isn't a measured percentage for this specific product."**

## 6. Data Requirements
None. This task reads no new data and persists nothing — `title`/`body` are static strings owned by
the new component; no store, hook, or prop change on `DetectedActivesCard`'s existing data contract
(`resolvedActiveKeys`, `ingredientTokens`, `positionByKey`, `onePercentLine` — all unchanged,
already shipped by `explore-insights-v2` tasks 01–03).

## 7. Dependencies
- Depends on: `docs/tasks/explore_insights/03-actives-card-position-dose.md` (already shipped —
  `DetectedActivesCard` already renders position + the 1% line note this tooltip explains).
- Depends on: `src/components/routine/AttributionTooltip.tsx` (visual shell reused, not the
  per-match data logic).
- Blocks: nothing currently planned depends on this shipping first.
- External services: none.

## 8. Security & Privacy
- Authentication required: no (Phase 1 has no auth layer).
- Data sensitivity: none — static educational copy only, no user or product data included in the
  tooltip content.
- Compliance considerations: none beyond the existing local-only storage posture (CLAUDE.md).

## 9. Success Metrics
Phase 1 has no analytics pipeline; success is verified at acceptance time: every AC in §4 passes,
`npx tsc --noEmit` and `npm test` are clean, and a new co-located/component test
(`InfoTooltip.test.tsx` and an extension of `DetectedActivesCard.test.tsx`) covers open/close and
the always-same-content-on-both-screens assertion.

## 10. Open Questions
- [ ] Exact copy wording (§5) is `PLACEHOLDER`, pending design review — the draft above is
      illustrative, not final. → owner: design.
