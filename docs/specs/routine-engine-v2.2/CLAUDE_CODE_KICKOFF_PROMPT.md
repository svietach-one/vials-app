# Kickoff Prompt — Vials Routine Engine v1.2 (Phases 8–10)

Copy everything below the line into Claude Code (or Claude in a repo-connected session)
to start implementation.

---

I need you to implement three additive extensions to the Vials routine/conflict engine,
already fully specced. Read before touching any code:

1. `docs/PRD_Spec.md` v1.2 — read all of it, but especially §4.2.1, §4.2.2, §5.1, §5.2
   (Active Ingredient Density Insights subsection), and §6.
2. `docs/USER_STORIES.md` — US-23 through US-29 (acceptance criteria, source of truth for
   "done").
3. `docs/IMPLEMENTATION_PLAN.md` — Phase 8, Phase 9, Phase 10 (task breakdown, file paths,
   dependency notes — there are no new npm/expo packages needed for any of this).
4. `docs/SCREENS.md` — updated component descriptions for `ConditionSelector`,
   `ConflictWarningInline`'s new row kinds, `ClinicalRestrictionsBlock`,
   `ProcedureLifespanCard`/`FadingInteractivePrompt`, `SeasonalNoticeBanner`,
   `SkinProfileEditor`.
5. `docs/db-product-spec.md` and `docs/db-tech-design.md` — `spf_value` field addition
   (needed for Phase 10; skip if this repo doesn't include the backend/Supabase layer).

Also read the existing `src/utils/conflictEngine.ts` and its test suite in full before
writing anything — Phase 8/9 wrap and extend it, they do not replace it.

## Non-negotiable constraints (from the specs — do not deviate)

- **Zero behavior change for opted-out users.** Every existing test in the current
  `conflictEngine` test suite must still pass unmodified. US-27 requires a new regression
  test: run the suite twice per case (actual profile vs. `skinConditions` forced to `[]`)
  and assert equality whenever the actual profile also has no conditions selected.
- **Never rewrite the existing pairwise matrix or its call signature.** `detectConflicts()`
  keeps its current shape. New behavior wraps its output (`applyConditionSeverityModifiers`)
  or runs as an independent, parallel check (`getConditionRiskWarnings`,
  `getActiveDensityFindings`) — see `PRD_Spec.md` §4.2.2 for why this split exists.
- **Nothing in Phases 8–10 ever blocks saving anything.** No new Cabernet-style hard
  blocks. Everything here is Amber (caution) or Cobalt (informational) at most.
- **No absolute/prohibitive language anywhere in new copy.** Banned words: "cannot,"
  "can't," "must not," "forbidden," "unsafe," "do not use," "you should not," "never use."
  US-26 requires an actual lint test over the message-template tables, not just a style
  guideline — write that test.
- **The four new pairwise collision rows in `PRD_Spec.md` §5.2 (`BPO`+`RETI`, `BPO`+`VIT_C`,
  `BPO`+`ACID`, `BPO`+`PEPT`, `AZA`+`ACID`) are marked "proposed, pending clinical
  sign-off."** Implement `BPO`/`AZA` tag detection (`parseInciTags` additions) so the
  single-ingredient condition-risk checks work, but **do not wire these five pairs into
  the production `detectConflicts()` matrix** — leave that behind a clearly-named,
  currently-disabled constant/flag so it's a one-line flip once sign-off lands, not a
  re-implementation. Everything else in Phases 8–10 ships normally.

## Suggested implementation order

Follow the phase order in `IMPLEMENTATION_PLAN.md` — Phase 8 (skin conditions) → Phase 9
(active density, depends on Phase 8's `escalate()` helper) → Phase 10 (SPF adequacy,
fully independent, can be done in parallel with 8/9 if you want to split work). Within
each phase, do the `.0`/`.1` data-model-and-engine steps first and get their unit tests
green before touching any UI component — the UI wiring steps are mechanical once the
engine functions exist and are tested.

## What "done" looks like

- Every acceptance criterion in US-23 through US-29 has a corresponding test or is
  manually verifiable in the running app.
- `npx tsc --noEmit` is clean.
- The banned-phrase lint (US-26) exists and passes.
- The US-27 no-op regression test exists and passes.
- Nothing outside `src/utils/`, the specific screens/components named in `SCREENS.md`,
  `src/types/index.ts`, and the relevant store files was touched.

## If you get stuck or find a spec gap

The specs were written carefully but this is still a first pass — if you find a genuine
ambiguity or a case the acceptance criteria don't cover, don't guess silently. Flag it
explicitly (in a PR comment, commit message, or directly to me) with the specific doc
section it relates to, rather than picking a default and moving on. Two known, already-
flagged open items you'll likely bump into and should NOT try to resolve yourself:
`skinIssues[]` vs. the new `skinConditions[]` field possibly overlapping (`PRD_Spec.md`
§5.1 — needs product-owner input, not an engineering decision), and the seborrheic
dermatitis "rich/occlusive product" check being blocked on whether `Product.texture` (or
an equivalent field) exists in the catalog schema yet (`IMPLEMENTATION_PLAN.md` Phase
8.3 — if it doesn't exist, ship that one check as a documented no-op, don't add a new
catalog field to unblock it under this task's scope).

Start with Phase 8.0.
