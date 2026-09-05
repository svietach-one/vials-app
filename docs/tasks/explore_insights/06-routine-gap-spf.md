# 06 — Routine gap: say what this composition would and would not cover

**Depends on:** nothing (independent of 01–04, but do it last)
**Size:** M
**User-visible change:** yes.

---

## Context

`RoutinePlacementCard` (`src/components/catalog/RoutinePlacementCard.tsx:34`) shows a phase label from `ROUTINE_PHASE_LABELS` — `Cleansing`, `Treatment`, `Moisturizing`, `Sun Protection`. It is computed by `buildRoutinePosition` (`src/utils/productProfile/routinePosition.ts`), a pure lookup on category and class facts, with **no knowledge of the user's actual routine**.

So the card tells a user that a moisturiser goes in the moisturising step. They knew. The useful version reads the actual routine from `routinesStore` and says whether that slot is already occupied, and whether an obvious gap exists elsewhere.

`src/utils/spfAdequacy.ts` already implements SPF-adequacy checking for routines (audit §8D). Reuse it. Do not write a second SPF rule.

**Before starting:** read `spfAdequacy.ts` and `routinesStore.ts` and confirm the existing API can answer "does the morning routine contain adequate sun protection" for a given routine. If it cannot without modification, stop and report what is missing rather than reshaping that module — it is used by the routine engine and is not this task's to redesign.

---

## Changes

### `src/hooks/useCompositionInsights.ts`

Read routines: `const routines = useRoutinesStore((s) => s.routines);` — this hook does not currently import that store; adding it follows the same convention it already uses for `useProductsStore` and `useProfileStore` at `:62-63`.

Add to `CompositionInsights`:

```ts
routineFit: {
  /** Products already occupying the phase this composition maps to. */
  occupants: Array<{ id: string; label: string }>;
  /** True when the morning routine has no adequate sun protection. */
  morningSpfGap: boolean;
} | null;   // null when `category === null`, same gate as routinePosition
```

Occupants are resolved by walking `Routine.steps` (`RoutineStep` has `productType` and `productId`, `types/index.ts:453-477`), matching the phase from `buildRoutinePosition`, and joining `productId` against the products store for a label. Reuse the same `brand + name` label rule as task 04 — if task 04 has landed, extract that helper rather than writing it twice.

### `src/components/catalog/RoutinePlacementCard.tsx`

Keep the phase label. Add beneath it:

| Case | String |
|---|---|
| Phase occupied | `You already have {n} here: {labels}` — at most 2 labels, then `+{n} more` |
| Phase empty | `Nothing in this step yet` |
| Morning SPF gap, and this composition is not itself sun protection | `Your morning routine still has no SPF` |
| Morning SPF gap, and this composition **is** sun protection | `This would fill the SPF gap in your morning routine` |

The SPF line is the only one that may use `palette.amber` — a missing SPF is a genuine caution under the semantic mapping in `PRD_Spec.md` §2. The occupancy lines are informational: muted text, `palette.cobalt` or the flow's `palette.plum`.

Show the SPF line at most once, and never alongside a contradictory occupancy line.

---

## Acceptance criteria

- Occupants come from the live `routinesStore`, not from the products store alone; a step whose `productId` is null contributes nothing and does not crash.
- A hidden step (`RoutineStep.hidden === true`) is not counted as an occupant.
- Phase-empty and phase-occupied render their distinct strings.
- The SPF gap uses `spfAdequacy.ts`, with no duplicated rule.
- The "would fill the gap" variant appears only when the composition's own phase is sun protection.
- `category === null` → `routineFit` is `null` and the card renders exactly as it does today.
- `npm test` green, `npx tsc --noEmit` clean.

## Tests

- `useCompositionInsights.test.ts`: occupants resolution, null `productId`, hidden step excluded, `category === null` gate.
- `RoutinePlacementCard` test: all four copy cases, plus the mutual-exclusion rule between the two SPF variants.

## Out of scope

- Changing `spfAdequacy.ts` or `routinePosition.ts`.
- Day-of-week awareness. `detectConflicts`/`getConflictsForProduct` have no schedule dimension (audit §8E) and adding one is a separate piece of work.
- Any conflict detection (decision D3).
- Writing to `routinesStore` — this screen reads only.
