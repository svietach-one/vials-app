# Technical Design: Detected Actives — "What Order Means" Info Tooltip
Spec: docs/specs/explore-actives-order-info.md
Author: planner
Date: 2026-09-14

## 1. Architecture Overview
Purely presentational addition, no new data flow. `DetectedActivesCard.tsx` already receives
`positionByKey`/`onePercentLine` (`explore-insights-v2` tasks 01–03) and already renders per-row
position + the below-the-line note. This task adds one local-UI-state trigger (an info icon in the
card header) and one new static-content component, `InfoTooltip.tsx`, modeled on
`AttributionTooltip.tsx`'s existing shell. No hook, store, or prop changes propagate outward —
`CompositionInsightsSection.tsx`, `useCompositionInsights.ts`, `ExploreCompositionResultScreen.tsx`,
and `WishlistEntryDetailScreen.tsx` are all untouched, since both screens already render
`DetectedActivesCard` via the shared section and inherit the change automatically.

```
DetectedActivesCard.tsx
  header: title "Detected actives" + [new] info IconButton
                                        │ onPress → local useState(visible)
                                        ▼
                                   InfoTooltip (new; shell reused from AttributionTooltip.tsx)
                                        title: "What ingredient order means"
                                        body: static PLACEHOLDER copy (spec §5)
```

## 2. API Contracts
N/A — local-only app, no backend/HTTP surface in this repo (CLAUDE.md).

## 3. Implementation Tasks

### engineer (scope=frontend — app is frontend-only)

- FE-1: New static tooltip component — `src/components/ui/InfoTooltip.tsx`. Props:
  `{ visible: boolean; onClose: () => void; title: string; body: string }`. Reuses
  `AttributionTooltip.tsx`'s visual shell (backdrop `Pressable` + slide-up `View` card + header row
  with title + close `IconButton`, same `colors`/`radius`/`space`/`typography` tokens) verbatim,
  dropping the `matches: MatchedToken[]`/`getAliasMicroCopy` per-match logic entirely — renders
  `body` as a single `Text` block instead of a `ScrollView` of match rows. `testID="info-tooltip"`
  root, `testID="info-tooltip-close"` on the close button (mirrors `AttributionTooltip`'s own
  testID convention).

- FE-2: Wire the trigger — `src/components/catalog/DetectedActivesCard.tsx`. Add local
  `const [infoVisible, setInfoVisible] = useState(false)`. In `cardHeaderText`, after the title
  `Text`, add an `IconButton` (`icon={<Icon name="info" size={16} color={colors.statusInfo} />}`,
  `label="What ingredient order means"`, `variant="ghost"`, `size="sm"`,
  `testID="detected-actives-info-icon"`, `onPress={() => setInfoVisible(true)}`). Render
  `<InfoTooltip visible={infoVisible} onClose={() => setInfoVisible(false)} title="What ingredient
  order means" body={ACTIVES_ORDER_INFO_BODY} />` at the end of the component (sibling to `Card`,
  same placement pattern `AttributionTooltip` uses in `RoutineStepCard.tsx`). Copy strings live as
  local constants in this file.

- FE-3: No changes needed to `CompositionInsightsSection.tsx`, `useCompositionInsights.ts`,
  `ExploreCompositionResultScreen.tsx`, or `WishlistEntryDetailScreen.tsx` — confirmed via direct
  read that `DetectedActivesCard` receives no new props and all existing call sites are unaffected.
  (Listed explicitly so a reviewer can verify "nothing else changed" without re-deriving it.)

### qa-lead
- Extend `src/components/catalog/DetectedActivesCard.test.tsx` (create if this interaction isn't
  yet covered): info icon renders always (regardless of `rows.length`), tapping it opens
  `InfoTooltip` with the expected title/body, tapping close or the backdrop closes it. A co-located
  `InfoTooltip.test.tsx` covers the component standalone (visible/hidden, close callback fires).
- No new integration test file needed under `tests/explore-composition/` — this is a self-contained
  component-level change; the existing `ExploreCompositionResultScreen.test.tsx`/
  `WishlistEntryDetailScreen.test.tsx` suites only need a regression check that they still render
  `DetectedActivesCard` unchanged.

### engineer (unit tests, both scopes)
- FE-1 (`InfoTooltip.tsx`) and FE-2's new interaction get co-located test coverage per
  `.claude/rules/testing.md`, mirroring `AttributionTooltip`'s own test conventions where
  applicable.

## 4. Assumptions
- `InfoTooltip.tsx` lives in `src/components/ui/` (atoms), not `src/components/catalog/`.
  Alternative: keep it colocated in `src/components/catalog/` next to `DetectedActivesCard.tsx`,
  since that's its only current caller.
  Reason: its content is fully generic (title + body strings, no domain-specific props) — placing
  it in `ui/` matches this app's existing atoms/molecules split (`Card`, `IconButton`, `Tag` all
  live there) and makes it trivially reusable by a future unrelated card without a later move.
- The tooltip is a new component (`InfoTooltip`) rather than widening `AttributionTooltip.tsx`
  itself to accept an optional static-content mode.
  Alternative: add an optional `staticBody?: string` prop to `AttributionTooltip` that
  short-circuits its `matches`-mapping render branch.
  Reason: `AttributionTooltip`'s props (`displayName`, `matches: MatchedToken[]`) are structurally
  per-ingredient-match; bolting an unrelated static-content branch onto it would couple two
  independent concerns in one component and complicate its existing tests. A small duplicate shell
  (~40 lines, per `AttributionTooltip.tsx`'s own size) is cheaper than that coupling.
- Copy strings are inlined as local constants in `DetectedActivesCard.tsx` rather than added to
  `src/constants/labels.ts`.
  Alternative: add them to `labels.ts` alongside `ACTIVE_INGREDIENT_LABELS`/`CAPABILITY_LABELS`.
  Reason: `labels.ts` holds lookup tables keyed by a domain type (`Record<SomeKey, string>`); a
  single static title+body pair has no key to look up by and isn't reused elsewhere, so it doesn't
  fit that file's existing shape. Revisit if a second consumer needs the same copy.

## 5. Open Questions
Exact copy wording (spec §5) is `PLACEHOLDER`, pending design review — see spec §10. No open
questions blocking the mechanical implementation (component shell, trigger wiring, testIDs) —
engineer can build FE-1/FE-2/FE-3 now using the placeholder copy, and a copy-only follow-up swaps
the final strings in once design confirms them.
