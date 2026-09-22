# Vials — Task: Onboarding Quizzes (Phototype + Skin Type)
Task slug: vials-onboarding-quizzes
Date: 2026-08-04
Status: DESIGNED
Depends on: `vials-bottomsheet-consolidation` (reusable BottomSheet must exist first)
Touches: `SkinProfileSetupScreen`, `SkinProfileEditor` (Tab 4), `profileStore`, `src/types/index.ts`, new quiz components

---

## Goal

Let users who don't know their phototype or skin type reach the right answer via a short guided quiz, without forcing the quiz on users who already know. Two independent quizzes, each launched by an "I'm not sure" button beside its existing card selector.

---

## Core UX rules (apply to both quizzes)

1. **Cards stay as the primary selector.** The quiz is an optional path *to* a card selection, not a parallel way to save data. This keeps one source of truth.
2. **Entry point:** a secondary/text button under each card group — "Not sure? Help me figure it out" — opens a bottom sheet (reusable `BottomSheet`, `dismissible: true`) containing that quiz.
3. **One question per sheet screen**, progress dots on top (same pattern as `MarketingSlidesScreen`), large tap targets per DS.
4. **Tap an answer = select + auto-advance** (~250–300ms delay so the user sees the chip highlight before the screen changes). No "Next" button on question screens.
5. **Back arrow** in the sheet corner so a user can revise a previous answer (since there's no explicit confirm per question).
6. **Last question is the exception:** it uses an explicit "Show result" button, not auto-advance, because the next step is the result, not another question.
7. **Result does NOT save directly.** The sheet closes and returns to the card screen with the computed card **pre-selected/highlighted**, plus soft copy ("Looks like you're closest to…"). The user still confirms with a final tap. This matters most for darker/Asian skin, where phototype self-report is least reliable — the confirmation is a real safeguard, not a formality.
8. **Reusable from Tab 4.** The same "Not sure?" entry and quizzes must be available in `SkinProfileEditor`, not only during onboarding — skin type and phototype-feel genuinely change (season, age, procedures).
9. **No AI, no network.** Pure client-side static scoring (consistent with "No AI features ship in Phase 1 MVP").
10. **Session-local answers.** Individual answers are transient component state; only the final result (`phototype`, `skinType`, `sensitive`) persists to `profileStore`.

---

## Type changes (`src/types/index.ts` / `Profile`)

`phototype` already exists. Add:

```ts
skinType: 'oily' | 'dry' | 'combination' | 'normal'
sensitive: boolean
```

`sensitive` is a **separate flag, not a fifth skinType value** — oily/dry/etc. skin can each independently be sensitive; merging them into one axis loses information.

Not captured in the quiz (deliberate — see Quiz B notes): `dehydrated`. Dehydration is a temporary *condition*, not a skin *type*; any type can be dehydrated. It belongs in the (future) lifestyle diary as a per-day state, not in a one-time onboarding profile attribute.

---

## Quiz A — Phototype (4 questions)

Phototype uses a modified Fitzpatrick approach. Standard Fitzpatrick sunburn/tanning questions are validated as **weak for darker and Asian/South-Asian skin** — a validated Indian-population modification dropped tanning items as irrelevant and found self-reported **unexposed skin tone** correlated well with actual melanin index. So this quiz deliberately does **not** lean only on "do you burn"; it pairs a skin-tone discriminator (strong for darker skin) with a sun-reaction discriminator (strong for lighter skin) so no user falls in a gap where every question loses power.

**No race/ethnicity labels** anywhere (per US-03). Eye/hair color questions are **excluded** — the original scale wrongly assumes brown eyes for medium/deep skin, and for our 3 collapsed buckets they add noise.

We collapse to 3 buckets (not 6 Fitzpatrick types): Light/Fair (I–II), Medium/Olive (III–IV), Dark/Deep (V–VI) — matching the existing 3 phototype cards.

### Questions & weighting

| # | Question | Role | Weight |
|---|---|---|---|
| A1 | Natural tone of skin rarely exposed to sun (e.g. inner forearm) — 5 tone gradations, no racial labels | Primary discriminator, strongest for medium/deep skin | High |
| A2 | Reaction to sun with no protection (always burns → almost never burns) | Primary discriminator, strongest for light skin | High |
| A3 | Tendency to dark marks / hyperpigmentation after spots, cuts, or irritation | Clinically relevant for deep skin (laser/peel risk), pulls where A2 is weak | Medium |
| A4 | Tanning (tans easily and deeply → doesn't tan) | Tie-breaker only — validated as **weak** for non-white skin, so lowest weight; must not outweigh A1 | Low |

Scoring is **weighted**, not a flat sum, because different questions carry the signal for different users (A1/A3 lead for deep skin, A2 leads for light). Exact point values to be finalized with the answer sets; the constraint is that A4 can never override A1.

**Honesty note in code/UI:** even modified, a self-report phototype quiz is an approximation, especially for deep skin. Result copy stays soft ("closest to…"), and card confirmation is mandatory. If the app ever drives real laser/peel guidance off phototype, that needs the "not a substitute for professional advice" disclaimer already flagged in PRD §6.

---

## Quiz B — Skin Type (4 questions)

Determines two independent things: the **sebum axis** (`oily/dry/combination/normal`) and the **`sensitive` flag**. Skin type = oil production; dehydration = water content — different axes, so dehydration is intentionally out (see Type changes).

### Questions & mapping

| # | Question | Determines |
|---|---|---|
| B1 | How skin usually feels a few hours after washing with nothing applied: tight/rough/flaky · comfortable/normal · shiny T-zone only · shiny all over | Primary sebum-axis signal |
| B2 | Midday shine and where: nowhere · T-zone only · whole face | Separates combination from oily/dry; confirms B1 |
| B3 | Pores and breakouts: pores invisible/rare breakouts · visible in T-zone/occasional · large pores/frequent breakouts | Secondary oiliness marker |
| B4 | Reaction to new products: often stings/reddens · sometimes · almost never | `sensitive` flag (separate axis) |

B1–B3 corroborate each other for the sebum axis; B4 stands alone for `sensitive`.

**Dehydration guard (no extra question):** the most common misread is a dehydrated person answering "tight → dry" when they're actually, say, dehydrated-oily. We don't add a 5th question; instead B1's answer options explicitly separate "tight **and** flaky/rough" (→ dry) from "tight but also shiny in places / tightness right after washing that passes" (→ do **not** auto-conclude dry; this is a dehydration signal, left for the future diary rather than written as a skin type).

**Wording note:** B1 asks the user to recall their *usual* feel ("by midday your skin usually…"), not to run a live test — they've likely just installed the app. The real 30-min wash test can be offered as an optional "want a more precise check?" hint, never as a required precondition to answer.

---

## Screen changes

- `SkinProfileSetupScreen` (onboarding): add "Not sure? Help me figure it out" secondary button under the phototype card group → opens Quiz A sheet; add the same under the skin-type card group → opens Quiz B sheet.
- `SkinProfileEditor` (Tab 4): same two entry buttons, so both quizzes are re-takeable after onboarding.
- Both entry buttons use the DS secondary (outline/text) style, never the primary black CTA — the quiz is an optional aid, not the main path.

---

## Acceptance criteria

- [ ] `profileStore` / `Profile` type has `skinType` and `sensitive` (separate flag)
- [ ] Phototype and skin-type card selectors still work as direct pickers with no quiz taken
- [ ] "Not sure?" button under each card group opens the correct quiz in a `BottomSheet`
- [ ] Quiz A = 4 questions incl. unexposed-skin-tone (A1) and hyperpigmentation (A3); no eye/hair-color question; no race labels
- [ ] Quiz A scoring is weighted so A4 (tanning) cannot override A1 (tone)
- [ ] Quiz B = 4 questions; B4 sets `sensitive` independently of the sebum axis
- [ ] Quiz B does not emit a `dry` result from tightness alone when shine is also reported (dehydration guard)
- [ ] Answer = auto-advance with brief highlight delay; last question uses explicit "Show result"; back arrow present
- [ ] Result pre-selects the matching card with soft copy; user confirms with a final tap; nothing saves without that confirm
- [ ] Both quizzes re-takeable from `SkinProfileEditor` in Tab 4
- [ ] All scoring is offline/static; only the final result persists, not individual answers

---

## Open items

- Finalize exact answer-option text and point weights for both quizzes (not blocking structure; needed before ship).
- Confirm the 5 tone gradations in A1 are described by tone only, no racial/ethnic labels — worth a sensitivity read before shipping.
- A1/A3 discriminators are validated primarily on Indian-population data vs. melanin index; exact thresholds for African and East-Asian skin aren't separately validated here. Acceptable for 3 coarse buckets, but reinforces why card confirmation is mandatory — flag alongside the PRD §6 clinical-review items.
- Decide whether the optional wash-test hint in B1 is worth including in Phase 1 or is over-scoped.
