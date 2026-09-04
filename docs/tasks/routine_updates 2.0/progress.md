# Routine Step Grouping — Progress

**Status:** `NOT_STARTED`
**Spec:** `docs/specs/routine-step-grouping/` (PRD_Spec.md · SCREENS.md · USER_STORIES.md · IMPLEMENTATION_PLAN.md)
**Opened:** 2026-08-24
**Owner:** unassigned

---

## What this is

The Routine screen gains a grouping level: a step becomes a **process** (Cleanse, Treat, Moisturize…) holding one or more products, instead of being one product. Adds informational waits between steps, per-card completion, product zones and reapplication timing.

Render-layer change. `RoutineStep` still holds one product, `Routine.steps` stays a flat array, and the routine engine is not touched.

---

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 0 — Verify baseline | `NOT_STARTED` | Six assertions incl. `LAYERING_ORDER` values and the `actives.json` class list |
| 1 — Types and constants | `NOT_STARTED` | Additive; no migration expected — confirm, don't assume |
| 2 — Grouping and transition logic | `NOT_STARTED` | Pure functions; carries most of the test weight |
| 3 — Product fields on the shelf | `NOT_STARTED` | `zones`, `timing` on `Product` |
| 4 — Routine screen | `NOT_STARTED` | Largest diff |
| 5 — Completion | `NOT_STARTED` | New store; `gamificationEnabled` default flips to ON |
| 6 — Duplicate slot + cleanup | `NOT_STARTED` | Only phase touching existing safety-adjacent behaviour |

---

## Decisions taken during specification

Recorded so they are not relitigated:

- **Grouping at the render layer, not in the engine.** The engine already orders, schedules and safety-gates correctly. Promoting `StepAction` into it is possible later as an isolated task.
- **Eight actions**, no separate `pre_cleanse`. A makeup remover and a cleanser are one process; the engine's `pre_cleanse` slot stays a plan-construction concept.
- **Group order read from the persisted array**, not computed from `LAYERING_ORDER` — otherwise every manual drag is silently undone.
- **No period restrictions** beyond the one the engine already imposes on `spf`.
- **`zones` and `timing` on `Product`**; `scheduledDays` stays on `RoutineStep` because it varies per period.
- **Completion per card**, not per step, because a `reapply` product is used hours after the rest of its step.
- **Transitions are four verbal notes, no numeric waits.** The 5/10/15/20-minute set was specified and then removed: the pH mechanism behind long acid-to-retinoid waits is disputed by formulation-chemistry sources, absorption waits have no conclusive research behind them, and competitor apps differ by two orders of magnitude (Skin Bliss 20–30 s vs Layered 10–20 min). The surviving four rest on other mechanisms.
- **Pause and Remove separated by placement**, not by iconography: icons for the reversible actions, removal in the overflow sheet.

## Defects caught in spec review

Found before implementation, all fixed in the docs:

- consecutive-run grouping split `Moisturize` around `Mask` (indices 9/10/11)
- a hand-written step order contradicted `LAYERING_ORDER`
- computing order from `LAYERING_ORDER` would have killed drag
- invented period restrictions would have hidden a morning exfoliant
- `azelaic` / prose class names would have compiled and silently never fired
- `spf_filters` has no chemical/mineral discriminator, so a "chemical SPF" rule was unimplementable
- React Native has no inner shadow; the completed-card treatment needs an SVG overlay
- the 10–20 minute waits came from beauty publishing repeating a disputed claim; removed after checking primary-facing sources

---

## Open items

| Item | Blocking? | Note |
|---|---|---|
| Dermatologist sign-off on the four layering notes | Before launch, not before build | Two questions: are these four right, and should any numeric wait be reinstated — see `PRD_Spec.md` §5.2 before ratifying magazine numbers |
| Polish labels | No | Blocked on a localization layer that does not exist; this package ships English |
| `minRestHours: 72` declared but never read | No | Implement or delete; out of scope here |
| Position of `Mask` after `Moisturize` | No | Inherited from `LAYERING_ORDER`; correct for sleeping masks, arguable for sheet masks |
| Mockup not in the repo | No | Layout reference currently lives outside version control |

---

## Log

**2026-08-24** — Specification written and reviewed against shipped code (`productFacts.ts`, `slotting.ts`, `actives.json`, `tokens.ts`, `package.json`). Package committed to `docs/specs/routine-step-grouping/`. Not started.
