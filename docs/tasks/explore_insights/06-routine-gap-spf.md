# 06 — Routine gap: say what this composition would and would not cover

**Depends on:** nothing (independent of 01–04, but do it last before 07)
**Size:** M
**User-visible change:** yes.

> **Revision 2026-09-05 — read this first.** The original version of this task said "reuse `spfAdequacy.ts`, do not write a second SPF rule". That instruction was wrong and the execution correctly stopped on it. `getSpfAdequacyFinding` answers *"is the scheduled sunscreen strong enough"*, not *"is there any sunscreen"* — it returns `null` for four different states (no SPF at all / adequate SPF / not summer / not a Light-Fair phototype), so its return value cannot be read as "no gap". Its own docstring at `spfAdequacy.ts:74-76` says absence is deliberately not its concern.
>
> **Ruling: absence and strength are two different rules, and this task writes the absence one.** That is not a duplicate — nothing in the codebase answers it today. The reuse that was actually intended is the *traversal convention*, not the threshold logic: same step-walking and skip rules as `spfAdequacy.ts:89-107`. Do not modify `spfAdequacy.ts`, do not re-implement its SPF-30 threshold, and do not call it from here.

---

## Context

`RoutinePlacementCard` (`src/components/catalog/RoutinePlacementCard.tsx:34`) shows a phase label from `ROUTINE_PHASE_LABELS` — `Cleansing`, `Treatment`, `Moisturizing`, `Sun Protection`. It is computed by `buildRoutinePosition` (`src/utils/productProfile/routinePosition.ts`), a pure lookup on category and class facts, with **no knowledge of the user's actual routine**.

So the card tells a user that a moisturiser goes in the moisturising step. They knew. The useful version reads the actual routine from `routinesStore` and says whether that slot is already occupied, and whether an obvious gap exists elsewhere.

---

## New file: `src/utils/productProfile/morningSpfPresence.ts`

Pure module — no React, no react-native, no store, no I/O (`.claude/rules/architecture-review.md §2`).

```ts
export type MorningSpfState = 'present' | 'absent' | 'no-morning-routine';

export function getMorningSpfState(routines: Routine[], products: Product[]): MorningSpfState;
```

**Three states, not a boolean.** A user who has not built a morning routine at all must not be told their morning routine is missing SPF — that is nagging someone for not having started. `'no-morning-routine'` renders nothing.

Definitions:

- `'no-morning-routine'` — no routine with `timeOfDay === 'morning'`, or every morning routine has zero visible steps that resolve to a real product.
- `'present'` — at least one such step resolves to a product with `productType === 'spf'`.
- `'absent'` — a morning routine with real products exists, and none of them is `productType === 'spf'`.

Skip rules — copy them from `spfAdequacy.ts:94-99`, they are the established convention: skip `step.hidden`, skip `step.productId === null`, skip when no product matches the id, skip `product.isHidden`.

**Two deliberate differences from `spfAdequacy.ts`, document both in the file's docstring:**

1. **No phototype or season gate.** Absence of sun protection is worth mentioning year-round and at every phototype. The strength recommendation is scoped to Light/Fair-in-summer because a threshold claim needs that context; a presence observation does not.
2. **No day-of-week scoping.** `spfAdequacy.ts:89,96` scopes to today via `isScheduledOnDay`. This check looks across *all* scheduled days: a user standing in a shop scanning a product is not asking about today, and "you have SPF, just not on Tuesdays" is a confusing thing to say on this screen. Ignore `scheduledDays` entirely here.

`spfValue` is irrelevant to this module. A `productType === 'spf'` product counts as present whether or not its SPF number is known — that is precisely the line between this rule and the adequacy one.

**Before writing:** grep the repo for `US-29`. `spfAdequacy.ts:6,75` references it as the story that owns "no SPF scheduled at all". If a written US-29 exists in `docs/` or `USER_STORIES.md`, follow its wording and cross-reference it in the docstring instead of inventing a parallel definition. If it exists only as a code comment, note in the docstring that this module implements the absence half of US-29.

---

## Changes to `src/hooks/useCompositionInsights.ts`

Read routines: `const routines = useRoutinesStore((s) => s.routines);` — this hook does not currently import that store; adding it follows the same convention it already uses for `useProductsStore` and `useProfileStore` at `:62-63`.

Add to `CompositionInsights`:

```ts
routineFit: {
  /** Products already occupying the phase this composition maps to. */
  occupants: Array<{ id: string; label: string }>;
  morningSpf: MorningSpfState;
} | null;   // null when `category === null`, same gate as routinePosition
```

Occupants are resolved by walking `Routine.steps` (`RoutineStep` has `productType` and `productId`, `types/index.ts:453-477`), matching the phase from `buildRoutinePosition`, and joining `productId` against the products store for a label. Reuse the same `brand + name` label rule as task 04 — if task 04 has landed, extract that helper rather than writing it twice.

## Changes to `src/components/catalog/RoutinePlacementCard.tsx`

Keep the phase label. Add beneath it:

| Case | String |
|---|---|
| Phase occupied | `You already have {n} here: {labels}` — at most 2 labels, then `+{n} more` |
| Phase empty | `Nothing in this step yet` |
| `morningSpf === 'absent'`, this composition is not sun protection | `Your morning routine still has no SPF` |
| `morningSpf === 'absent'`, this composition **is** sun protection | `This would fill the SPF gap in your morning routine` |
| `morningSpf === 'present'` or `'no-morning-routine'` | render no SPF line at all |

The SPF line is the only one that may use `palette.amber` — a missing SPF is a genuine caution under the semantic mapping in `PRD_Spec.md` §2. The occupancy lines are informational: muted text, `palette.cobalt` or the flow's `palette.plum`.

Show the SPF line at most once, and never both variants together.

---

## Acceptance criteria

- `spfAdequacy.ts` is **not** modified and **not** imported by any file this task touches.
- The SPF-30 threshold appears nowhere in the new module.
- All three `MorningSpfState` values are reachable and each has a test.
- `'no-morning-routine'` renders no SPF line — a user with an empty routine is never told something is missing.
- A morning routine containing an SPF product with `spfValue === null` returns `'present'`.
- A step scheduled only on some days still counts toward presence (no day filtering).
- Occupants come from the live `routinesStore`; a step whose `productId` is null contributes nothing and does not crash.
- A hidden step (`RoutineStep.hidden === true`) and a hidden product (`product.isHidden`) are excluded from both occupancy and SPF presence.
- Phase-empty and phase-occupied render their distinct strings.
- The "would fill the gap" variant appears only when the composition's own phase is sun protection.
- `category === null` → `routineFit` is `null` and the card renders exactly as it does today.
- `npm test` green, `npx tsc --noEmit` clean. **Existing `spfAdequacy.test.ts` passes unchanged** — if it does not, this task touched something it should not have.

## Tests

- New `src/utils/productProfile/morningSpfPresence.test.ts`: all three states; hidden step; hidden product; dangling `productId`; SPF product with unknown `spfValue`; SPF scheduled on one weekday only; empty `routines` array.
- `useCompositionInsights.test.ts`: occupants resolution, null `productId`, hidden step excluded, `category === null` gate.
- `RoutinePlacementCard` test: all copy cases, plus the mutual-exclusion rule between the two SPF variants, plus both silent states.

## Out of scope

- Modifying `spfAdequacy.ts` or `routinePosition.ts` in any way.
- Any SPF *strength* judgement. This task only ever says present / absent.
- Day-of-week awareness. `detectConflicts`/`getConflictsForProduct` have no schedule dimension (audit §8E) and adding one is separate work.
- Any conflict detection (decision D3).
- Writing to `routinesStore` — this screen reads only.
