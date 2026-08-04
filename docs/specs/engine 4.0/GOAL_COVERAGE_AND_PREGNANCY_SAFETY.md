---
addendum_to: PRD_Spec.md v1.2, USER_STORIES.md, IMPLEMENTATION_PLAN.md
feature: Goal-Coverage Hints + Pregnancy/Lactation Safety Guard
version: 1.0
status: DRAFT — pregnancy ingredient list is grounded in mainstream ACOG/AAD-level
  consensus (stronger evidence base than the §5.2 collision proposal), but still routed
  through the same clinical sign-off as PRD §6 before launch
date: 2026-07-25
---

# Goal-Coverage Hints + Pregnancy/Lactation Safety Guard

## 1. Two linked features, one design

Two things the user asked for, tied together because safety must win when they collide:

1. **Goal-coverage hints** — when a user has picked skincare goals (wrinkles, pores,
   dryness, pigmentation, sebum control, restoration, protection) but nothing in their
   routine — or nothing on their shelf at all — addresses a goal, tell them gently.
2. **Pregnancy/lactation safety guard** — when `UserProfile.pregnantOrbreastfeeding` is
   set, never surface a restricted active as the answer to a goal, flag restricted actives
   already in the routine, and point the user to a professional.

The link: **safety outranks goal coverage.** If a user is pregnant, has the goal
"wrinkles," and the only wrinkle-relevant product on their shelf is a retinoid, the app
must NOT say "you have nothing for wrinkles" (which nudges them toward the retinoid) and
must NOT say "add your retinoid." It says: pregnancy-safe options exist for this goal
(Vitamin C, azelaic acid), and for anything restricted, check with a professional.

This also closes a gap that already exists in the shipped UI: the Edit Skin Profile sheet
already shows a `ListRow` (`PREGNANCY_LABEL`, field `pregnantOrBreastfeeding` on
`UserProfile`) with hint text "We'll flag retinoids and other restricted actives." That
promise is already made to users; the engine behind it is what this feature builds. The
hint says "retinoids **and other restricted actives**" — plural and broader than `RETI`
alone — which is itself the requirement that the guard cover more than one tag.

## 2. Skincare goals — data model

Formalizes the previously-vague `skinIssues[]` field. Per earlier open items in this doc
package, `skinIssues[]`'s semantics were never defined; this feature defines them.

```ts
export type SkinGoalType =
  | 'wrinkles' | 'pores' | 'dryness' | 'pigmentation'
  | 'sebum_control' | 'restoration' | 'protection';

// UserProfile — goals captured optionally in onboarding and editable in profile
skinGoals: SkinGoalType[];   // default: []
```

> **Open item (carried forward, now actionable):** if the existing `skinIssues[]` field
> already holds goal-like values, `skinGoals` should replace/migrate it rather than sit
> alongside — confirm with the product owner. The new field is introduced separately here
> to avoid silently overloading an undefined field, same caution applied to
> `skinConditions[]` earlier.

## 3. Goal → ingredient-tag mapping

Reuses the taxonomy already built (`RETI`/`ACID`/`VIT_C`/`PEPT`/`BPO`/`AZA` +
barrier group `CERA`/`PANT`/`GLYC`/`NIAC`/`ZPCA`/`HYAL`), plus one new tag `HYDRO`
(hydroquinone — see §5). "Protection" is the exception: it maps to a product *type*
(`SPF`), not an ingredient tag, so it reuses the Phase 10 SPF machinery, not tag parsing.

| Goal | Relevant tags | Notes |
|---|---|---|
| Wrinkles | `RETI`, `PEPT`, `VIT_C` | |
| Pores | `ACID`, `NIAC` | BHA-class within `ACID` most relevant |
| Dryness | `HYAL`, `GLYC`, `CERA`, `PANT` | humectant/barrier emphasis |
| Pigmentation | `VIT_C`, `AZA`, `NIAC`, `ACID`, `RETI`, `HYDRO` | |
| Sebum control | `ACID`, `NIAC`, `BPO`, `ZPCA` | |
| Restoration | `CERA`, `PANT`, `PEPT` | barrier/repair emphasis; overlaps Dryness on `CERA`/`PANT` |
| Protection | *(product type `SPF`)* | not tag-based; reuses Phase 10 `spfValue`/SPF-presence logic |

## 4. Pregnancy/lactation restriction tiers

Grounded in mainstream obstetric/dermatology consensus (ACOG, AAD, FDA-referencing
sources). This is a **stronger, less contested evidence base** than the §5.2 ingredient-
interaction proposal — the retinoid restriction in particular is close to universal — but
it still routes through the same clinical sign-off gate (PRD §6) before launch, and the
copy never diagnoses or gives a categorical medical instruction.

| Tier | Tags | Consensus basis | Guard behavior |
|---|---|---|---|
| **Restricted** | `RETI`, `HYDRO` | Topical retinoids advised against in pregnancy by ACOG as a precaution (mechanism shared with teratogenic oral retinoids; safe threshold not established). Hydroquinone consistently on "avoid" lists due to high absorption. | Never offered as a goal solution. If present in the routine, flagged with a soft advisory + explicit "consider checking with your doctor or dermatologist." Never a hard block — the user may be acting on their own practitioner's advice. |
| **Caution** | `ACID`, `BPO` | Salicylic acid (BHA): low-concentration rinse-off generally low-risk, high-concentration leave-on advised against — our `ACID` tag doesn't encode concentration, so the copy must stay non-specific. Benzoyl peroxide: generally considered safe at low OTC doses, but flagged one tier up as "discuss" out of caution since we don't encode dose. | Not offered as the *primary* goal solution when a Safe-tier alternative exists; if surfaced or already in routine, mild "some forms of this are used with caution during pregnancy — a professional can advise" note. |
| **Safe alternative** | `AZA`, `VIT_C`, `NIAC` | Explicitly named across sources as pregnancy-safe alternatives to retinoids for anti-aging, brightening, and pigmentation. | Actively preferred as the goal solution surfaced to pregnant/breastfeeding users. |
| **Unaffected** | `HYAL`, `GLYC`, `CERA`, `PANT`, `PEPT`, `ZPCA`, `SPF` | Humectants, barrier ingredients, peptides, sunscreen — no pregnancy restriction in the consulted consensus. | Normal behavior. |

> **`BPO` placement note:** research actually supports `BPO` as pregnancy-*safe* at low
> OTC concentration (AAD names it a safe option). It's placed in **Caution rather than
> Safe** deliberately, because Vials can't read concentration from an INCI tag and the
> cost of over-cautious "check with a professional" copy is far lower than the cost of
> greenlighting something the app can't actually verify the strength of. This is a
> product-safety judgment, not a contradiction of the evidence — flagged explicitly so the
> clinical reviewer can confirm or relax it.

## 5. New tag: `HYDRO` (hydroquinone)

The shipped pregnancy hint promises to flag "retinoids and other restricted actives," and
hydroquinone is one of the most consistently listed restricted actives — and it maps
directly onto the Pigmentation goal, so it can't be omitted without the guard silently
under-delivering on both the hint and the goal mapping. Added as a conflict-grade
`ActiveIngredientKey` (it's a restriction-relevant active, not a barrier ingredient):

```ts
// ActiveIngredientKey gains:
'HYDRO'  // Hydroquinone
// parseInciTags regex: /hydroquinone/i
```

No new *pairwise* collision rules for `HYDRO` in this pass — like `BPO`/`AZA`, it exists
for single-ingredient (here: safety-guard and goal-coverage) detection, not the collision
matrix. If a `HYDRO`-vs-other-active interaction ever needs flagging, that's a separate
clinically-reviewed matrix change.

## 6. The safety-outranks-coverage resolution

Pseudocode for the combined check (runs in the component render cycle, like every other
engine call — never from a store):

```ts
export interface GoalCoverageFinding {
  goal: SkinGoalType;
  kind: 'covered_in_routine'          // goal has a product, and it's scheduled — no UI
      | 'on_shelf_not_in_routine'     // product exists but isn't scheduled — gentle nudge
      | 'not_on_shelf'                // nothing on the shelf addresses it — softest note
      | 'safety_redirect';            // pregnancy: only restricted actives would address it
  message: string;
  suggestProfessional: boolean;       // true only for safety_redirect / restricted-in-routine
}

export function getGoalCoverageFindings(profile, catalog, routineSteps): GoalCoverageFinding[] {
  if (profile.skinGoals.length === 0) return [];
  const findings = [];
  for (const goal of profile.skinGoals) {
    const relevantTags = GOAL_TAG_MAP[goal];
    const shelfMatches = catalog.filter(p => productHasAnyTag(p, relevantTags));
    const routineMatches = shelfMatches.filter(p => isScheduled(p, routineSteps));

    if (profile.pregnantOrBreastfeeding) {
      const safeShelf = shelfMatches.filter(p => tierOf(p) === 'safe' || tierOf(p) === 'unaffected');
      const onlyRestricted = shelfMatches.length > 0 && safeShelf.length === 0;
      if (onlyRestricted) {
        // safety outranks coverage: do NOT say "you have nothing" (nudges toward the retinoid)
        findings.push({ goal, kind: 'safety_redirect', suggestProfessional: true,
          message: goalSafetyRedirectCopy(goal) });   // e.g. names AZA/VIT_C as pregnancy-friendly options for this goal
        continue;
      }
      // otherwise fall through using only the safe subset as "matches"
    }

    if (routineMatches.length > 0)      continue;                       // covered — no UI
    else if (shelfMatches.length > 0)   findings.push(onShelfNudge(goal));
    else                                findings.push(notOnShelfNote(goal));
  }
  return findings;
}
```

Also independent of goals: if `pregnantOrBreastfeeding` and any **Restricted**-tier product
is scheduled in the routine at all (regardless of whether it maps to a stated goal), emit a
standalone advisory with `suggestProfessional: true` — this is the literal fulfillment of
the shipped hint's "we'll flag retinoids and other restricted actives" promise.

## 7. UI, tone, monetization

- **Placement:** Today screen, after routine creation, as a dismissible Cobalt
  informational banner (goal-coverage) — reusing `SeasonalNoticeBanner`'s dismiss
  infrastructure. Optionally also a passive note during Weekly Plan creation ("this routine
  will be built from what you have; nothing here targets your 'pores' goal yet").
- **Color:** Cobalt for goal-coverage nudges (informational). The pregnancy safety
  advisory for a restricted active *already in the routine* uses Amber (caution) — it's the
  one place this feature is cautioning rather than merely informing — but still never
  Cabernet, and never blocks anything.
- **Professional redirect:** the safety paths (`safety_redirect`, restricted-in-routine)
  MUST include an explicit, plain-language "consider checking with your doctor or
  dermatologist" line. This is the one place in the whole doc package where redirecting to
  a professional is mandatory, not optional.
- **Tone:** same banned-phrase rules as US-26 (no "cannot/unsafe/forbidden"). Safety copy
  is calm and non-diagnostic: "During pregnancy or breastfeeding, some actives like
  retinoids are usually set aside — a professional can help you choose what's right."
- **Monetization:** per product owner decision, this is a **free feature**, not gated
  behind Vials Pro. This is a deliberate, documented departure from
  `Vials_Business_Plan_v1_1.docx` §4, which had listed a "pregnancy/lactation safety mode"
  as a Pro feature — safety-critical guidance is kept free, consistent with the business
  plan's own §3.1 principle that safety warnings are never behind a paywall. The Pro tier
  can still layer *analytical depth* (e.g. detailed prescriptive-active breakdowns) on top
  later; the core guard is free.

## 8. All-fitzpatrick / all-skin-type applicability

The goal→tag mapping is function-based and applies across all skin types and phototypes.
One additive nuance (not a blocker): for Dark/Deep phototype (Fitzpatrick V–VI),
`ACID`/`RETI`-based goal suggestions (Pores, Pigmentation, Sebum control) should carry the
same gentle "introduce gradually" caution already applied elsewhere, because aggressive
introduction of exfoliants/retinoids carries a higher post-inflammatory hyperpigmentation
risk for deeper skin tones — which the app already acknowledges in `PhototypeSelector`'s
existing "Dark/Deep — elevated laser/peel risk" copy. This is a copy nuance layered on the
existing condition-modifier mechanism, not a new gate.

## 9. Task Breakdown — Phase 11

(Note: the earlier `IMPLEMENTATION_PLAN.md` "Future Phases" placeholder used "Phase 11
(candidate)" for a broader *proactive shelf optimization* idea. This feature — goal
coverage + safety guard — is a smaller, well-scoped subset that's ready now; it takes the
Phase 11 slot, and the broader optimization idea moves to Phase 12 (candidate).)

### Phase 11.0 — Data Model
- Add `SkinGoalType` and `skinGoals: SkinGoalType[]` to types + profile store
- Add `HYDRO` to `ActiveIngredientKey`; `parseInciTags` regex
- Confirm `pregnantOrBreastfeeding` field is already present on `UserProfile` (it is) —
  wire engine reads to it

### Phase 11.1 — Engine
- `src/utils/goalCoverage.ts` (NEW): `GOAL_TAG_MAP`, `PREGNANCY_TIER_MAP`,
  `getGoalCoverageFindings()`, standalone restricted-in-routine check
- Unit tests: each goal's coverage states (covered / on-shelf-not-scheduled / not-on-shelf);
  pregnancy safety-redirect (only-restricted-on-shelf → redirect, not "nothing found");
  safe-alternative preference; restricted-in-routine standalone flag; `skinGoals === []`
  no-op

### Phase 11.2 — UI
- Onboarding: optional goal selection step (reuses `ConditionSelector`-style multi-select)
- `SkinProfileEditor`: goals editable; `pregnantOrBreastfeeding` `ListRow` already exists
- Today screen: Cobalt goal-coverage banner + Amber pregnancy-safety advisory, both
  dismissible; mandatory professional-redirect line on safety paths
- Optional: passive note in Weekly Plan creation flow

### Phase 11.3 — Compliance
- Banned-phrase lint extended to goal/safety message templates (US-26)
- **Clinical sign-off:** pregnancy tier table (§4) added to the PRD §6 combined review
  pass. The retinoid/hydroquinone restrictions are high-consensus, but the `ACID`/`BPO`
  caution-tier placement and the exact professional-redirect copy specifically need
  reviewer confirmation.
- Verify the shipped `PREGNANCY_LABEL` hint text ("We'll flag retinoids and other
  restricted actives") now matches actual behavior — the engine must flag at least `RETI`
  and `HYDRO`, satisfying "and other restricted actives."

**Dependencies:** none new.

## 10. Test Matrix Summary

| Scenario | Expected result |
|---|---|
| No goals selected | No goal-coverage UI at all (no-op) |
| Goal "dryness," shelf has a hyaluronic serum, scheduled | No finding (covered) |
| Goal "pores," shelf has a BHA product, not in any routine | Cobalt "on shelf, not scheduled" nudge |
| Goal "wrinkles," nothing on shelf addresses it | Cobalt softest "nothing yet" note |
| Pregnant, goal "wrinkles," only shelf match is a retinoid | `safety_redirect` — names VIT_C/AZA as pregnancy-friendly options + professional redirect; does NOT say "you have nothing" |
| Pregnant, goal "pigmentation," shelf has vitamin C (safe) + hydroquinone (restricted) | Uses vitamin C as the covered match; hydroquinone separately flagged if scheduled |
| Pregnant, retinoid scheduled, no matching goal stated | Standalone restricted-in-routine advisory + professional redirect (fulfills the shipped hint) |
| Not pregnant, retinoid scheduled | No pregnancy advisory — guard only fires when the flag is set |
| Dark/Deep phototype, goal "pores," BHA suggested | Suggestion carries gentle gradual-introduction caution |
