# 07 — A minimal event layer, so this batch is measurable

**Depends on:** 03, 04, 06 (it instruments them)
**Size:** S
**User-visible change:** none.

---

## Context

Grep for `analytics`, `trackEvent`, `logEvent` across `src/` returns zero results (audit §7). Nothing in the Explore flow is instrumented: we cannot see how many people open it, how many reach the result, how many save anything, or whether the changes in tasks 03/04/06 moved any of it. Every future decision about this screen is currently a guess.

This task does **not** pick an analytics vendor and does **not** send anything over the network. It adds the seam — one function, one pluggable sink — so instrumentation exists at the call sites and a provider can be wired in later by changing one file.

---

## New file: `src/utils/analytics.ts`

```ts
export type AnalyticsEvent =
  | { name: 'explore_capture_started'; method: 'photo' | 'paste'; category: ProductType | null }
  | { name: 'explore_result_viewed';
      ingredientCount: number;
      activesCount: number;
      onePercentLineFound: boolean;
      shelfOverlapCount: number;
      hasSkinType: boolean;
      shelfSize: number }
  | { name: 'explore_saved'; destination: 'shelf' | 'wishlist' }
  | { name: 'explore_skin_type_nudge_tapped' }
  | { name: 'explore_dismissed' };

export function trackEvent(event: AnalyticsEvent): void;

/** Swap the sink. Default sink: `__DEV__` console log, no-op otherwise. */
export function setAnalyticsSink(sink: (event: AnalyticsEvent) => void): void;
```

A discriminated union, not `trackEvent(name: string, props: Record<string, unknown>)`. Typed events are the only thing that keeps an event schema honest over time, and this codebase is strict TypeScript throughout.

`trackEvent` must never throw and never block: wrap the sink call in try/catch and swallow. An analytics failure must not be able to break a screen.

### Hard privacy rule — enforce it in the type, not in a comment

**No event may carry ingredient text, product names, brand names, free text, or any user-authored string.** Only counts, booleans and closed enums, as in the union above. This app's whole positioning is local-first and private (`LocalDataWarningModal`, the export/backup story), and shipping an event that phones home with someone's INCI paste would contradict that outright.

The union above already enforces this structurally. Keep it that way: if a future event needs a string, it must be a closed union of literals, never `string`.

---

## Call sites

| Event | Where |
|---|---|
| `explore_capture_started` | `ExploreCompositionCaptureScreen.tsx` — in `handleCapture` (`:83-87`) with `method: 'photo'`, and in `handleParsePress` (`:89-94`) with `method: 'paste'` |
| `explore_result_viewed` | `ExploreCompositionResultScreen.tsx` — a `useEffect` on mount, reading the values off `useCompositionInsights` plus `findOnePercentLine`'s result |
| `explore_saved` | both footer paths: "Put on Shelf" and the Wishlist modal's Save |
| `explore_skin_type_nudge_tapped` | the nudge action added in task 05 |
| `explore_dismissed` | the header back action on the result screen |

Fire `explore_result_viewed` **once per mount**, not on every insights recomputation — guard with a ref, and test that a re-render does not re-fire it.

---

## Acceptance criteria

- `trackEvent` with no sink configured is a silent no-op outside `__DEV__` and does not throw.
- A sink that throws does not propagate — the screen still renders.
- `explore_result_viewed` fires exactly once per mount, including when the insights memo recomputes.
- All five events fire from the listed call sites.
- No event type admits a bare `string` field.
- No network call is added anywhere in this task.
- `npm test` green, `npx tsc --noEmit` clean.

## Tests

New `src/utils/analytics.test.ts`: no-op default, sink receives events, throwing sink is swallowed.
Extend `tests/explore-composition/*`: each call site fires its event; `explore_result_viewed` fires once across a re-render.

## Out of scope

- Choosing or integrating an analytics provider (PostHog, Amplitude, anything). Separate decision, separate task.
- Any network transport, queueing, or persistence of events.
- Instrumenting screens outside the Explore flow.
- A user-facing opt-out toggle — needed before any real provider is wired in, but pointless while the sink is a no-op.
