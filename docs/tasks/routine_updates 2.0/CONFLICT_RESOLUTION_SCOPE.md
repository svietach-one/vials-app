---
addendum_to: PRD_Spec.md §5.2, USER_STORIES.md US-09, conflictEngine.ts
feature: Time-of-Day-Resolvable vs Day-Level Conflicts
version: 1.0
status: DRAFT — research + design; ingredient-pair classification pending clinical sign-off
  (same gate as PRD §6)
date: 2026-07-25
---

# Time-of-Day-Resolvable vs Day-Level Conflicts

## 1. The problem

The current conflict engine treats every pairwise conflict as **day-level binary**: if two
conflicting tags land on the same day, it warns — regardless of whether they're in the AM
slot or the PM slot. Per `PRD_Spec.md` §5.2 and `USER_STORIES.md` US-09, collisions are
evaluated "strictly on a per-day basis" and "on the exact same day," with no notion of
time-of-day separation.

Dermatologically, that's too coarse. The engine's conflicts actually have **two different
mechanisms**, and they respond differently to AM/PM separation:

1. **Degradation / incompatibility conflicts** — caused by the two actives being in
   *simultaneous contact* on the skin (one oxidizes or destabilizes the other, or a pH
   mismatch). Applying them in **separate slots (AM vs PM) genuinely resolves the problem**
   — they never coexist on the skin, so nothing degrades. This is standard dermatological
   guidance ("vitamin C in the morning, retinol at night").

2. **Additive-irritation conflicts** — caused by cumulative irritation load over the day.
   The skin does not "reset" between morning and evening, so splitting into AM/PM **does
   not fully resolve** it. These often need separation onto **different days**, not just
   different slots.

Today the engine applies the day-level rule to *both* categories. The consequence:

- **False positives on degradation pairs.** A user who correctly schedules Vitamin C in AM
  and Retinol in PM — a textbook-correct routine — still gets a conflict warning. The
  engine is flagging a routine that dermatology would approve. This erodes trust in the
  warning system (the "different apps give opposite verdicts" credibility problem already
  called out in `docs/explore-result-redesign.md` §2.2).
- The engine is *correctly* strict on additive-irritation pairs, so those should stay
  day-level.

## 2. What the user asked for

> "If two products conflict in one routine but I split them AM/PM, is that enough? Or is
> same-day never allowed?"

And the directive: **if a pair can safely be same-day-but-different-slot, the engine should
allow it** (no warning) rather than flag it. Pairs that genuinely need day-level separation
stay flagged even across slots.

## 3. Design: per-pair resolution scope

Add a **resolution scope** to each conflict pair in the matrix — how much separation is
needed to clear the conflict:

```ts
type ResolutionScope =
  | 'slot'   // resolved by AM/PM separation — only warn if BOTH in the SAME slot same day
  | 'day';   // resolved only by different days — warn if same day, regardless of slot
```

The engine's collision check changes from "are both tags present on the same day?" to:

- For a `slot`-scoped pair: warn only if both tags are present **in the same period (AM or
  PM) on the same day**. AM+PM on the same day → no warning.
- For a `day`-scoped pair: warn if both tags are present **on the same day**, in any slot
  (unchanged from today's behavior).

This is additive — the existing day-level logic becomes the `day` branch; `slot` is the new
relaxation.

### 3.1 Important interaction with the existing "different days = no conflict" rule
US-09 already says a pair scheduled on *different days* produces no warning. That stays true
for both scopes — resolution scope only refines what happens **within** the same day:

| Scheduling | `slot`-scoped pair | `day`-scoped pair |
|---|---|---|
| Different days | No warning (unchanged) | No warning (unchanged) |
| Same day, different slots (AM vs PM) | **No warning (NEW — relaxed)** | Warning (unchanged) |
| Same day, same slot (both AM or both PM) | Warning | Warning |

### 3.2 "Different routines, same day" = different slots
The user framed it as "same day but different routines." In Vials's model, AM and PM are
represented as separate routines (`Routine.timeOfDay: 'morning' | 'evening'`, per
`src/types/index.ts`). So "different routines on the same day" **is** the AM/PM-separation
case. A `slot`-scoped pair split across the morning routine and the evening routine is
exactly the case that should now be allowed. Two products in the *same* routine (both
morning, or both evening) are the same-slot case → still warned.

> Note: this makes the period/slot the unit of resolution, which aligns cleanly with the
> existing `RoutineChecklistContainer` AM/PM split and with the Phase 9 density check, which
> already operates per-period. No new scheduling concept is introduced.

## 4. Per-pair classification (RESEARCH — pending clinical sign-off)

Based on the mechanism of each conflict already documented in `PRD_Spec.md` §5.2 and the
`BPO`/`AZA` research in `SKIN_CONDITIONS_04_COLLISION_MATRIX_RESEARCH.md`. Mechanism drives
scope: degradation/pH → `slot`; additive irritation → `day`.

| Pair | Mechanism | Proposed scope | Rationale |
|---|---|---|---|
| `VIT_C` + `RETI` | Degradation / pH + stability; also the canonical "C in AM, retinol in PM" split | **slot** | Textbook AM/PM separation; flagging the split routine is a false positive |
| `ACID` + `VIT_C` | pH instability on simultaneous contact | **slot** | Separation removes the simultaneous-contact pH problem |
| `BPO` + `RETI` | BPO oxidizes the retinoid on contact | **slot** | Separated in time → no contact → no oxidation (also removes most compounded irritation) |
| `BPO` + `VIT_C` | BPO oxidizes ascorbic acid on contact | **slot** | Same oxidizer-vs-antioxidant logic; separation resolves it |
| `RETI` + `ACID` | Additive irritation / over-exfoliation | **day** | Irritation load accumulates across the day; AM/PM split does not fully resolve for reactive skin. Keep day-level. |
| `ACID` + `PEPT` | Acidic environment degrades peptides | **slot** *(tentative)* | Degradation-type mechanism → separation should help. **Lower confidence — flag for reviewer:** peptide degradation is contact/pH-driven, so slot-separation is plausible, but evidence is thinner than the VIT_C pairs. |
| `PEPT` + `VIT_C` | Interaction reducing efficacy | **slot** *(tentative)* | Efficacy-interaction, contact-driven → separation plausible. Same lower-confidence caveat. |
| `BPO` + `ACID` | Additive over-exfoliation/irritation | **day** | Irritation-type, not degradation → accumulates over day. Keep day-level. |
| `AZA` + `ACID` | Additive irritation | **day** | Irritation-type. Keep day-level. |

Non-conflicting pairs (`RETI`+`PEPT`, `AZA`+`VIT_C`, `AZA`+`PEPT`, `AZA`+`RETI`) have no
scope — they never warn regardless.

**Confidence split for the reviewer:** the `slot` classification is strongest for the three
the user explicitly named (`VIT_C`+`RETI`, `BPO`+`RETI`, `BPO`+`VIT_C`) plus `ACID`+`VIT_C`
— all clean degradation/pH mechanisms. The two peptide pairs (`ACID`+`PEPT`, `PEPT`+`VIT_C`)
are marked tentative and could stay `day` if the reviewer prefers caution. The irritation
pairs staying `day` is the safe default and needs no aggressive review.

## 5. Copy implications

When a `slot`-scoped pair is detected in the **same slot**, the warning can now be more
actionable — it can suggest the resolution the engine knows about:

> "Vitamin C and retinol are both in your morning routine. These are usually kept apart —
> try moving one to your evening routine."

This is strictly better UX than today's generic same-day warning, and it only became
possible because the engine now knows the pair is slot-resolvable. For `day`-scoped pairs,
the copy stays as-is (suggest different days), since suggesting AM/PM would be wrong advice.

All copy stays within the existing banned-phrase rules (US-26): no "cannot/never use,"
framed as "usually kept apart / consider moving."

## 6. Backward-compatibility / no-regression

- Pairs classified `day` behave **exactly as today** — no change for the additive-irritation
  conflicts, which are the majority-risk cases.
- The only behavior change is `slot`-scoped pairs no longer warning when split across AM/PM.
  This is a **relaxation** (fewer warnings), so it cannot introduce a new false *block* —
  and nothing here blocks anyway.
- Regression test: every existing US-09 test case where a pair is same-slot or same-day-
  same-slot must still warn. Add new cases asserting `slot`-pairs split AM/PM do NOT warn,
  and `day`-pairs split AM/PM still DO warn.

## 7. Open questions / clinical sign-off

- The per-pair scope table §4 needs the same licensed-practitioner sign-off already required
  for the §5.2 matrix and §5.3 spacing table (`PRD_Spec.md` §6) — route as one combined
  pass. Specifically confirm: the two tentative peptide pairs, and that keeping
  `RETI`+`ACID` at `day` (not relaxing it to slot) is the right call for reactive skin.
- Interaction with skin conditions (Phase 8): should an eczema/rosacea user get `slot`-pairs
  kept at `day` scope (i.e. more conservative — even the split routine warned) because their
  skin is more reactive? Plausible, mirrors the severity-escalation logic already in
  Phase 8. Flag for reviewer; if yes, it's a small addition — condition modifiers can
  promote a pair's scope from `slot` to `day` for that user, same mechanism as severity
  escalation. Not building it until confirmed.

## 8. Task Breakdown — Phase 12

(Takes the Phase 12 slot; the earlier "proactive shelf optimization" candidate moves to
Phase 13.)

### Phase 12.0 — Data model
- Add `ResolutionScope` type; add a `scope: ResolutionScope` field to each conflict entry in
  the `conflictEngine.ts` matrix constants. Default existing entries to `day` (no behavior
  change) until §4 is signed off, then flip the approved pairs to `slot`.

### Phase 12.1 — Engine
- Update the collision check to branch on scope: `slot` → compare within-period presence;
  `day` → existing same-day presence. Requires the check to know each tag's period, which
  the routine step already carries (`RoutineStep.period`).
- Unit tests per the §6 matrix (slot AM/PM no-warn, slot same-slot warn, day always warn).

### Phase 12.2 — Copy
- `ConflictWarningInline`: slot-scoped same-slot conflicts get the "try moving one to your
  [other] routine" actionable copy; day-scoped keep "different days" copy. Banned-phrase lint
  covers new templates.

### Phase 12.3 — Compliance
- Scope table §4 into the combined clinical review pass (PRD §6)
- Condition-interaction question (§7) resolved with reviewer before any Phase 8 tie-in

**Dependencies:** none new. Uses `RoutineStep.period` / `Routine.timeOfDay`, already present.

## 9. Test Matrix Summary

| Scenario | Expected |
|---|---|
| `VIT_C` AM + `RETI` PM, same day (slot pair) | **No warning (new)** |
| `VIT_C` AM + `RETI` AM, same day (slot pair, same slot) | Warning + "try moving one to evening" |
| `RETI` AM + `ACID` PM, same day (day pair) | Warning (unchanged — irritation accumulates) |
| `RETI` Mon + `ACID` Wed (any pair, different days) | No warning (unchanged) |
| `BPO` AM + `VIT_C` PM, same day (slot pair) | No warning |
| Non-conflicting pair (`RETI`+`PEPT`), any scheduling | No warning (unchanged) |
| Eczema user, `VIT_C` AM + `RETI` PM (slot pair) | Pending §7 decision — default no-warning unless reviewer promotes scope for reactive skin |
