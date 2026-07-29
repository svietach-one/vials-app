# Task: Hormone therapy — personalization signal (NOT a safety block)

Task slug: hormone-therapy-personalization
Status: DISCOVERY / PROPOSAL — needs a product decision before any engine work. This file is mostly open
questions on purpose.
Depends on: `UserProfile.hormoneTherapy` (exists, schema v6) and its onboarding toggle
(`TASK_onboarding_redesign.md` step 4).

---

## 0. The key distinction from pregnancy — read first

Hormone therapy is **not** a safety-block feature. It is fundamentally different from
`pregnantOrBreastfeeding`, and conflating the two would be a design error:

- **Pregnancy** = certain topical actives are commonly cautioned → the engine *freezes* them. Safety.
- **Hormone therapy** = systemic hormones change skin behavior (oil, dryness, sensitivity) → the engine
  might *personalize* recommendations. There is **no topical active that is contraindicated because
  someone is on hormone therapy.** Topical skincare does not meaningfully interact with systemic HRT.

So nothing here freezes, blocks, or warns. The only question is whether — and how — to let this flag
nudge personalization. The type comment already says as much:

> "Collected for future personalization (sebum/sensitivity weighting) — no downstream logic reads it
> yet."

This task does not assume that weighting should be built. It asks whether it should, and flags the real
risks of building it wrong.

---

## 1. The clinical picture (draft, general — needs review if acted on)

General dermatology understanding of how gender-affirming hormone therapy affects skin. **Individual and
time-varying** — not a fixed rule per person:

- **Masculinizing therapy (testosterone):** tends to *increase* sebum production; acne is common,
  especially in the first ~1–2 years, then often settles. Skin may coarsen.
- **Feminizing therapy (estrogen / anti-androgens):** tends to *decrease* sebum; skin often becomes
  drier, thinner, and can be more reactive/sensitive; androgenic acne often reduces over time.

Two things this list is NOT:
1. **Not deterministic.** The effect depends on the therapy type, dose, duration, and the individual.
   Someone six years into testosterone may have completely settled skin. The flag is a single boolean —
   it does not know any of this.
2. **Not tied to the `gender` field.** A trans woman on estrogen and a cis woman are not the same skin
   context; a trans man on testosterone and a cis man are not either. The whole reason `hormoneTherapy`
   exists as a *separate* field (per `TASK_onboarding_redesign.md`) is that `gender` alone can't capture
   this. Any logic that reads `hormoneTherapy` must not silently assume a direction from `gender`.

**The problem:** a single boolean `hormoneTherapy: true` doesn't tell you *which* direction (masculinizing
vs feminizing) the skin is trending. Without that, the engine can't safely infer "more oil" vs "drier."
See §3.

---

## 2. Why this is a product decision, not an engineering one

Auto-changing someone's routine based on hormone-therapy status is risky in ways that aren't technical:

- **Stereotyping risk.** Inferring skin behavior from a hormone-therapy flag can feel presumptuous or
  plain wrong for the individual in front of the app, especially given §1's variability. Getting it wrong
  for a trans user specifically — a group already poorly served by beauty tech — is a worse failure than
  not personalizing at all.
- **The user already told us their skin.** Onboarding collects `skinType`, `concerns`, and `goals`
  directly. If someone on testosterone has oily, acne-prone skin, they'll have *said so* — and the engine
  already routes on that. Layering a hormone-derived guess on top risks double-counting or contradicting
  the user's own stated input, which should always win.
- **It changes over time.** A static flag can't track that T-therapy acne peaks early and settles. A
  guess baked into scoring could stay wrong for years.

Given all that, the safe default is **do not auto-modify the routine engine from this flag.** Persist it,
optionally surface a gentle non-prescriptive note, and treat the user's own stated skin type/concerns as
the source of truth. Anything more needs an explicit product decision.

---

## 3. Options (for the product decision)

Presented worst-effort-first. **Recommend Option 1 for now.**

### Option 1 — Persist only, no engine effect (RECOMMENDED default)
- Store the flag (already done). Build nothing that reads it into the engine.
- Rationale: the user's directly-stated `skinType`/`concerns`/`goals` already capture the *actual* skin
  state the hormones produce, without guessing. Zero stereotyping risk, zero double-counting.
- This is honest about what a single boolean can support.

### Option 2 — Gentle, non-prescriptive nudge at onboarding only
- If `hormoneTherapy` is on, show a one-time informational line near the skin-type step, e.g.:
  > "Hormone therapy can change your skin's oil and sensitivity over time. If your skin has shifted, you
  > can update your skin type and concerns anytime in your profile."
- No engine change. It just prompts the user to keep *their own* stated inputs current — which the engine
  already respects. Low risk, arguably genuinely helpful.

### Option 3 — Capture direction, then weight scoring (NOT recommended without strong product intent)
- Requires first extending the data model: a single boolean is insufficient (§1). Would need e.g.
  `hormoneTherapyType: 'masculinizing' | 'feminizing' | 'other' | null` — which is a more intrusive
  onboarding question and a more sensitive one to ask.
- Only then could scoring nudge (e.g. weight oil-control classes up for masculinizing). Even then it
  fights the user's stated inputs (§2) and needs clinical + product + ideally community sign-off.
- Flag it as a real can of worms. Don't drift into it from Option 1/2 without an explicit decision.

---

## 4. If (and only if) Option 3 is chosen — engineering notes

Do not start this without a written product decision. Notes for if it happens:

- **Data model first.** Add `hormoneTherapyType` to `UserProfile`; the boolean alone can't drive
  direction. Update onboarding step 4 to capture it only when `hormoneTherapy` is on. Treat it as
  sensitive data (it's health + gender-identity adjacent) — same on-device-only guarantees as the rest of
  the profile; never leaves the device (consistent with the whole app's local-first privacy stance).
- **Mechanism.** The routine engine scores candidates in `resolve.ts::scoreCandidate` and has a
  `prioritize`/`limit` mandate system (`collectPrioritizeTargets` / `collectLimits`). A hormone-driven
  nudge would most naturally be a `prioritize` bias (raise oil-control classes for masculinizing; raise
  barrier/hydration for feminizing), NOT a freeze — nothing here is unsafe, so nothing should be frozen
  or made non-overridable.
- **User input always wins.** Any hormone weighting must be strictly weaker than the user's explicit
  `skinType`/`concerns`/`goals`. If the user set an oil-control goal, the engine already does the right
  thing; the nudge must never override or contradict an explicit user choice — only break ties in the
  absence of one.
- **No new safety severity.** This never produces an `avoid`/`caution` `ClinicalConflictResult` and never
  a `pregnancy_blocked`-style freeze. It is scoring bias only.
- Clinical + product sign-off on the direction mapping, same gate as every other unverified rule in the
  project.

---

## 5. Acceptance criteria (for the recommended path, Option 1/2)

- [ ] `hormoneTherapy` continues to persist via `updateProfile` (already true) — no engine reads it.
- [ ] No freeze, block, warning, or `ClinicalConflictResult` is ever produced from this flag — confirmed
      by grep: nothing in the routine engine or `ConflictEngine` branches on `hormoneTherapy`.
- [ ] If Option 2 is chosen: a single onboarding informational line, ≥14px, non-prescriptive, pointing
      the user back to their own editable skin type/concerns; shown once; no engine effect.
- [ ] The distinction from `pregnantOrBreastfeeding` is documented in code comments where the flag is
      read (if anywhere), so a future contributor doesn't mistake it for a safety input.
- [ ] Option 3 is explicitly marked "requires product decision + data-model change" and is NOT
      implemented as a side effect of this task.

---

## 6. One-line summary for the product owner

Pregnancy = safety, the engine should act (freeze/block). Hormone therapy = personalization, the engine
should probably stay out of it and let the user's own stated skin type/concerns lead — because a single
boolean can't tell oil-up from oil-down, and guessing wrong for trans users is a worse outcome than not
guessing. Persist the flag; decide later, deliberately, whether to do more.
