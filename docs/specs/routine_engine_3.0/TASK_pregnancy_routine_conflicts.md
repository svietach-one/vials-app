# Task: Pregnancy / breastfeeding safety handling (routine engine + clinic)

Task slug: pregnancy-safety-handling
Status: PROPOSAL — this document IS the "Phase 3 §4.3" decision that
`decisionReasons.ts` and Phase 7 both defer to. Nothing downstream has defined this yet; this spec
defines it. **Requires product + clinical sign-off before merge** (see §1).
Depends on: `UserProfile.pregnantOrBreastfeeding` (exists, schema v6) and its onboarding toggle
(`TASK_onboarding_redesign.md` step 5). Coordinates with Phase 7 (`DecisionReasonCode` enum + override
flow).

---

## 0. Why this document exists

`src/constants/decisionReasons.ts` contains, verbatim:

> `pregnancy_blocked` is intentionally absent — deferred with Phase 3 §4.3.

and Phase 7 (`7.3 Override`) contains:

> **[OPEN]** The original phase also lists `PREGNANCY_BLOCKED` as non-overridable. Deferred with
> Phase 3 §4.3.

There is no "Phase 3 §4.3" document in the repo — the name is a placeholder for a decision that was
never written down. Both the reason-code enum and the override flow were deliberately built to leave a
`pregnancy_blocked` shaped hole. This task fills it. Because two already-merged systems reserved space
for it, the implementation must slot into their conventions, not invent a parallel mechanism.

---

## 1. Clinical sign-off is a hard prerequisite — read first

Every ingredient/procedure threshold in this project that isn't verified carries an explicit
"pending clinical review" gate: the §5.3 procedure-spacing table, the `proposedPairRules.ts` rows behind
`PROPOSED_V12_PAIR_RULES_ENABLED`, the `attribution` position gates in `actives.json`. Pregnancy safety
is squarely in that category and is **higher stakes than any of them**.

Rules:
- The ingredient and procedure lists in this spec are a **draft compiled from general dermatology
  guidance**, not verified clinical direction. They exist to make the engineering shape concrete, not to
  be shipped as-is.
- Ship the whole feature behind a feature flag (`PREGNANCY_SAFETY_ENABLED`, default `false`), exactly
  like `PROPOSED_V12_PAIR_RULES_ENABLED`. Detection/persistence of the profile flag can ship on; the
  *acting on it* (freezes, blocks, banners) stays gated until sign-off.
- All user-facing copy avoids definitive safety claims and always routes to a professional. The app
  surfaces this as information about commonly-cautioned ingredients, never as medical advice — same
  framing already mandated for the clinical layer in `PRD_Spec.md` §6.
- **Do not** let the model's or the implementer's own judgment substitute for the sign-off. If the
  reviewer hasn't signed the list, the flag stays off.

---

## 1a. The three-tier rule — freeze / caution+consult / nothing

This principle governs every ingredient and procedure decision in this spec. It exists so that "see a
specialist" never dilutes a clear prohibition, and a clear prohibition never replaces a genuine
consult-your-doctor case:

- **Tier 1 — Obvious → block/freeze.** Where the consensus is clear (e.g. retinoids in pregnancy;
  injectables/deep peels), the engine acts: a non-overridable routine freeze or a block-with-acknowledge
  on procedures. Don't water this down to a soft warning.
- **Tier 2 — Ambiguous → caution + consult, do NOT invent a prohibition.** Where guidance is genuinely
  mixed or concentration-dependent (e.g. AHA/BHA at low strength, benzoyl peroxide), do **not** freeze
  everything to be safe — that makes the app alarmist and untrustworthy. Surface it as a caution that
  routes the user to a professional for a personal recommendation, and leave the choice with them.
- **Tier 3 — Low risk → nothing.** No flag, no noise.

**Disclaimer is universal across all tiers.** Every user-facing string — even a Tier-1 hard freeze —
ends by routing to a professional and never states a categorical medical claim. Not "this is dangerous"
but "commonly avoided during pregnancy or breastfeeding — paused; check with your doctor." The block
tells the user *what the app did and why*; the doctor tells them *what's right for them*.

"See a specialist" here means **disclaimer copy on the banner/card**, not a separate gating screen. If
product later wants an active pre-save "discuss this with a dermatologist" step for Tier-2 items, that's
a distinct UX flow — spec it separately, don't fold it in here.

---

## 2. Two independent surfaces

Pregnancy touches two separate engines that do **not** share a code path. Keep them separate.

| Surface | Engine | Mechanism | Overridable? |
|---|---|---|---|
| A. Routine ingredients | routine engine (`resolve.ts` + `effectiveRuleset`) | a new freeze source folded into the effective ruleset | **No** (per Phase 7) |
| B. Clinic procedures | `ConflictEngine` (hardcoded `check*` methods) | a new `checkPregnancyConflict()` sibling to `checkSeasonalConflict()` | n/a (block + acknowledge, per US-18) |

---

## 3. Surface A — routine ingredient freeze

### 3.1 Mechanism — reuse the ruleset freeze, don't bolt on a `ConflictEngine` method

The routine engine already freezes ingredient classes during procedure rehab via `procedures.json`:

```json
{
  "phase": { "fromDay": 0, "toDay": 14 },
  "action": "freeze",
  "targets": { "classes": ["retinoid", "vitamin_c_pure", "benzoyl_peroxide"] },
  "reasonCode": "peel_rehab_no_aggressive_actives"
}
```

Pregnancy is the same shape of thing — "freeze these classes while a condition holds" — except the
condition is a boolean profile flag, not a calendar phase. So it belongs as a **new freeze source folded
into `effectiveRuleset`**, alongside the season / phototype / procedure sources, NOT as a bespoke method
on `ConflictEngine`. A one-off method would sit outside the decision-log/override machinery that Phase 7
is building, which is exactly what we must not do given `pregnancy_blocked` is already reserved in that
machinery.

### 3.2 Where it's assembled — VERIFY before implementing

`resolve.ts` consumes `input.context.effectiveRuleset` and `collectLimits(input.context)` /
`collectPrioritizeTargets(input.context)`, but the assembly of `effectiveRuleset` from its sources
(season mask, phototype modifiers, procedure rules) happens upstream in files not yet reviewed for this
task — likely `src/utils/routineEngine/context.ts` and `src/utils/routineEngine/mandates.ts`, and target
matching in `src/utils/routineEngine/targeting.ts` (`matchesRuleTargets`). **Open those first** and
confirm:
- how the procedure freeze source is merged in (that's the closest analog),
- whether a freeze can be marked non-overridable there or whether that's enforced later, and
- how `RuleTargets` (`{ classes: [...] }` / `{ properties: { irritancy: ">=3" } }`) is resolved, so the
  pregnancy targets use the same vocabulary.

Model the pregnancy source on the procedure freeze source. If the assembly turns out to make a
JSON-authored `pregnancy.json` ruleset the natural fit (mirroring `seasons.json`), prefer that — a
data-authored rule is easier for the clinical reviewer to audit than inline TS. Decide based on what the
assembly code actually supports, and note the choice in the PR.

### 3.3 Draft class list — PENDING CLINICAL SIGN-OFF (§1)

Freeze source active only when `profile.pregnantOrBreastfeeding === true`. Draft targets, with the real
`ActiveIngredientKey` values from `actives.json`:

| Target | Draft action | Rationale (draft, unverified) | Note |
|---|---|---|---|
| `retinoid` | freeze | Retinoids are the most consistently cautioned topical class in pregnancy across general guidance. | Highest-confidence entry; still needs sign-off. |
| `aha` / `bha` | **review — do not default-freeze without a decision** | Concentration matters and general guidance often tolerates low-strength topical use. The classes carry `potency` on their matchers, so a potency-gated freeze (freeze only `high`, keep `low` with a note) is technically expressible — but whether to do that is a clinical call, not an engineering one. | Present the potency-gate option to the reviewer explicitly. |
| `benzoyl_peroxide` | review | Mixed guidance; commonly considered lower-risk topically. Don't default-freeze; flag for the reviewer. | — |
| hydroquinone | **cannot be handled — coverage gap** | Not a class in `actives.json` at all, so the engine literally cannot see it. Frequently cautioned in pregnancy. | Out of scope until the tag taxonomy adds it — open a separate ticket; don't silently imply the engine covers it. |
| everything else | no freeze | Barrier/hydration/soothing classes and derivatives are generally considered low-risk. | — |

Encode the decision as data (a class→action map or a `pregnancy.json` ruleset), never as inline
conditionals, so the sign-off pass is a one-file diff.

### 3.4 Non-overridable — the hard part

Phase 7 §7.3 states `pregnancy_blocked` is **non-overridable**, grouped with the retinoid-in-AM period
block — the two exceptions to the otherwise-universal "I understand the risk, add anyway" override.

- The retinoid-in-AM hard block lives in eligibility (period-eligibility), not in the override flow — a
  file not reviewed here (`src/utils/routineEngine/eligibility.ts`). **Read it** to see how a
  non-overridable exclusion is expressed today, and mirror that for the pregnancy freeze rather than
  inventing a second "non-overridable" concept.
- Concretely: when Phase 7's override logic checks whether a frozen product can be forced back in, a
  freeze carrying `reasonCode: 'pregnancy_blocked'` must be rejected the same way a retinoid-in-AM
  placement is. Coordinate the exact hook with whoever implements Phase 7 §7.3 — this task and that one
  touch the same override gate and must agree.

### 3.5 Reason code — coordinate with Phase 7

- Add `pregnancy_blocked` to the `DecisionReasonCode` enum and to the `REASON_TEXT` dictionary in
  `src/constants/decisionReasons.ts`. Phase 7 §7.1 is closing that enum and making a missing dictionary
  entry a compile error — so this addition must land in step with Phase 7, not conflict with it. If
  Phase 7 is already merged, this is a clean addition; if it's in flight, sync with its author.
- Draft dictionary text (English, ≥14px per project convention, no definitive claim):
  > `pregnancy_blocked: 'Commonly avoided during pregnancy or breastfeeding — paused. Check with your doctor.'`
- The reason line surfaces on the reserve/frozen product card that Phase 7 §7.2 builds — no separate UI
  needed there; it rides the same explainability surface as every other freeze.

---

## 4. Surface B — clinic procedure block

This side genuinely IS a bespoke `ConflictEngine` method, because procedures don't go through the
routine `effectiveRuleset` — they go through the hardcoded `check*` methods
(`checkSeasonalConflict`, `checkPhototypeConflict`, `checkProcedureCollision`), each returning
`ClinicalConflictResult | null` with `severity: 'avoid' | 'caution'`.

### 4.1 New method — mirror `checkSeasonalConflict` exactly

```ts
static checkPregnancyConflict(
  procedure: CosmeticProcedureKey,
  isPregnantOrBreastfeeding: boolean,
): ClinicalConflictResult | null {
  if (!isPregnantOrBreastfeeding) return null;
  const severity = PREGNANCY_PROCEDURE_SEVERITY[procedure];
  if (!severity) return null;
  return { severity, explanation: /* per-procedure */, suggestion: /* consult a professional */ };
}
```

### 4.2 Draft procedure severities — PENDING CLINICAL SIGN-OFF (§1)

Real `CosmeticProcedureKey` values from `index.ts`:

| Procedure | Draft severity | Rationale (draft, unverified) |
|---|---|---|
| `botox` | `avoid` | Injectable neurotoxin; routinely deferred in pregnancy/breastfeeding. |
| `fillers` | `avoid` | Injectable; routinely deferred. |
| `smas_lifting` | `avoid` | Energy-based; routinely deferred. |
| `mesotherapy` | `avoid` | Injectable; routinely deferred. |
| `chemical_peel_deep` | `avoid` | Already seasonally blocked for UV; pregnancy is an independent reason. |
| `mechanical_facial` | `caution` | Non-invasive; lowest-risk category, advisory only in this draft. |

Encode as `PREGNANCY_PROCEDURE_SEVERITY: Partial<Record<CosmeticProcedureKey, ConflictSeverity>>`, data
not conditionals, commented as draft-pending-review.

### 4.3 Wiring — VERIFY against `AddProcedureModal`

`AddProcedureModal` (Clinic, Tab 3) isn't reviewed here. It already calls the existing `check*` methods
and renders their `ClinicalConflictResult`. Read it and confirm the existing block behavior before
wiring:

- `US-18` specifies seasonal/collision checks **block Save** and require an explicit *"I understand the
  risk, log anyway"* acknowledgment. If the modal branches that behavior on `severity` (block for
  `avoid`, advisory for `caution`), then adding `checkPregnancyConflict()` next to the other calls gets
  the right behavior for free.
- Call all applicable checks and render whichever fire; don't let the pregnancy check silently replace an
  existing seasonal/collision result. If several fire, show them together (or the strictest) — match
  however the modal already handles multiple existing results.
- **Note the asymmetry vs Surface A:** the clinic block is overridable (block + acknowledge, per US-18)
  because a patient may be acting on their own practitioner's advice; the routine ingredient freeze
  (Surface A) is non-overridable per Phase 7. This is intentional — do not "unify" them. A procedure is a
  one-off logged event under practitioner supervision; a routine active is a daily unsupervised habit.

---

## 5. Today-screen surfacing (optional, confirm scope)

The earlier product decision was to surface pregnancy warnings on the Today screen and at add-time. With
Surface A implemented as a routine-engine freeze, flagged products are **already** excluded from the
generated routine and already carry a reason line on their reserve card (Phase 7 §7.2) — so a separate
Today-screen banner may be redundant. Two options, pick with product:

- (a) Rely on the Phase 7 reserve-card reason line — no new banner. Simpler, single source of truth.
- (b) Add a dedicated dismissible-for-today (never permanently) banner summarizing "N products paused for
  pregnancy safety" for extra visibility.

Default to (a) unless product wants the extra visibility of (b). Do **not** wire any such banner into the
permanent `AppSettings.dismissedBanners` mechanism — a safety flag must not be silenceable forever.

---

## 6. Acceptance criteria

- [ ] `PREGNANCY_SAFETY_ENABLED` flag added (default `false`); all acting-on-the-flag behavior gated
      behind it; profile detection/persistence works regardless.
- [ ] Surface A implemented as a freeze source folded into `effectiveRuleset` via the same assembly path
      as the procedure freeze — confirmed against the actual assembly code, not assumed.
- [ ] Frozen-for-pregnancy products carry `reasonCode: 'pregnancy_blocked'` and are **non-overridable**,
      enforced the same way retinoid-in-AM is; coordinated with Phase 7 §7.3.
- [ ] `pregnancy_blocked` added to the `DecisionReasonCode` enum + `REASON_TEXT`, in step with Phase 7
      §7.1's enum-closing work (no compile error, no orphan).
- [ ] Class freeze list encoded as data, commented as draft-pending-clinical-review; the aha/bha
      potency-gate question and the benzoyl_peroxide question are explicitly put to the reviewer.
- [ ] hydroquinone coverage gap noted as a separate ticket, not silently implied as handled.
- [ ] `ConflictEngine.checkPregnancyConflict()` added, mirroring `checkSeasonalConflict`'s signature and
      return shape; procedure severities encoded as data, draft-flagged.
- [ ] `AddProcedureModal` calls it alongside the existing checks and renders consistently; the
      block-vs-advisory behavior matches the existing severity handling — confirmed against the real
      component.
- [ ] All copy avoids definitive safety claims and routes to a professional.
- [ ] Surface A (non-overridable) vs Surface B (overridable block) asymmetry preserved, not unified.
- [ ] `npx tsc --noEmit` clean.
- [ ] Clinical sign-off obtained before the flag flips to `true` — tracked, not assumed.

---

## 7. Implementation-time code discovery (run this before writing any freeze)

Three parts of this spec depend on code not reviewed when it was written (§3.2, §3.4, §4.3). Resolve all
three by reading the actual code first. Do NOT implement until each is answered — report findings, then
build.

```
1. How effectiveRuleset is assembled (§3.2).
   - Open src/utils/routineEngine/context.ts and src/utils/routineEngine/mandates.ts
     (grep for "effectiveRuleset", "collectLimits", "collectPrioritizeTargets",
     and for how procedures.json freezes get merged in).
   - Find the exact point where the season / phototype / procedure freeze sources
     are folded into the ruleset the engine resolves against.
   - Decide: add the pregnancy freeze as (a) another source folded in at that same
     point in TS, or (b) a JSON ruleset mirroring seasons.json? Pick based on what the
     assembly code actually supports; prefer the data-authored option if it's a natural
     fit (easier for a clinician to audit). State your choice and why.
   - Confirm how RuleTargets ({ classes: [...] } / { properties: {...} }) is resolved
     by reading src/utils/routineEngine/targeting.ts (matchesRuleTargets), so the
     pregnancy targets use the identical vocabulary.

2. How a non-overridable exclusion is expressed today (§3.4).
   - Open src/utils/routineEngine/eligibility.ts and find the retinoid-in-AM hard
     block (grep "retinoid", "am", "period", "eligib"). This is the one existing
     exclusion Phase 7 §7.3 calls non-overridable.
   - Determine the exact mechanism that makes it non-overridable (a period-eligibility
     gate, a flag on the frozen item, a check in the override path, etc.).
   - Mirror that same mechanism for a freeze carrying reasonCode 'pregnancy_blocked'
     so Phase 7's override flow rejects forcing it back in — the same way retinoid-in-AM
     is rejected. Do NOT invent a second, parallel "non-overridable" concept.
   - If Phase 7's override gate isn't merged yet, leave a clearly-marked hook + a note
     for its author rather than guessing at an interface that doesn't exist yet.

3. How AddProcedureModal renders clinical check results (§4.3, Surface B).
   - Open the AddProcedureModal component (Clinic / Tab 3; grep "checkSeasonalConflict",
     "checkPhototypeConflict", "checkProcedureCollision", "ClinicalConflictResult").
   - Confirm how it currently blocks Save + requires the "I understand the risk, log
     anyway" acknowledgment (US-18), and whether that behavior branches on severity
     ('avoid' = block, 'caution' = advisory).
   - Wire checkPregnancyConflict() in next to the existing check calls so it renders
     the same way. If several checks fire at once, match however the modal already
     handles multiple results (show together or strictest) — don't let the pregnancy
     result silently replace an existing one.

After reading, update §3.2, §3.4, and §4.3 in place with the concrete file paths, function names, and
mechanisms found, replacing the "VERIFY before implementing" placeholders. Then implement, honoring the
Tier-1/2/3 rule in §1a and the universal consult-a-professional disclaimer.
```
