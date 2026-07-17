# Phase 8 — Data Migrations (Confirmation Prompts, Peptide Re-attribution, Goals)

Depends on: Phases 1, 3.

> **Reconciled 2026-07-17.** Most of this phase **already shipped in schema
> v2**. The phototype and vitamin C *data* migrations exist; only their
> confirmation prompts are missing. The PEPT migration has no input and is
> replaced. See `DISCREPANCY-REPORT.md` §1 (#7, #8, #9).

## Actual state

- `CURRENT_SCHEMA_VERSION = 2`, `BASELINE_SCHEMA_VERSION = 1`
  (`migrations.ts:22`). The runner lives in `src/services/storage.ts:50` and
  runs before hydration. Every migration is **already** idempotent and already
  returns the same reference when nothing changes (`migrations.ts:16`) — the
  original task 4 is architecturally satisfied.
- **Phototype migration is done.** `deriveFitzpatrick()` implements exactly the
  mapping the original phase specifies (`type_1_2→1`, `type_3_4→4`,
  `type_5_6→6`); `UserProfile.fitzpatrick` is re-derived whenever `phototype`
  changes. Missing: `phototypeNeedsConfirmation` and the 6-card confirm UI.
- **Vitamin C migration is done** via `legacyKeyMap` (`vitamin_c` →
  `vitamin_c_pure`), and the `vitaminCAutoMigrated` persistent flag the wizard
  prompt needs **already exists** (`migrations.ts:92,107`). Missing: the prompt.
- **There is no `PEPT` tag** and there never was — `ActiveIngredientKey` has
  `copper_peptides`. The original task 3 has no input data.

## Problem

Two migrations landed silently: users were assigned a Fitzpatrick type and a
vitamin C classification without ever confirming them, and the engine now makes
safety decisions on those unconfirmed values. Separately, Phase 1's new peptide
subclasses mean some persisted `copper_peptides` tags are now wrong.

## Tasks

### 8.1 Phototype confirmation (data migration already done)

Add `phototypeNeedsConfirmation: boolean` to `UserProfile`; set it for profiles
whose `fitzpatrick` was auto-derived rather than user-chosen. Show the 6-card
selector once on next entry with the migrated card pre-selected — confirm or
refine.

Until confirmed, the engine keeps using the migrated value **conservatively**,
which it already does: `deriveFitzpatrick` maps to the *stricter* member of
each group (`migrations.ts:30`), so 3–4 → 4 and 5–6 → 6 take the strict PIH
branches. No engine change — the prompt is UI plus one flag.

### 8.2 Vitamin C wizard prompt (data migration already done)

For products carrying `vitaminCAutoMigrated`, prompt once: *"Is this pure
vitamin C (L-Ascorbic Acid) or a derivative?"* Choosing derivative re-tags to
`vitamin_c_derivative`, lifting the low-pH restrictions.

The flag exists and is already persisted; this is the UI that consumes it, plus
clearing the flag on answer so it never re-prompts.

### 8.3 Peptide re-attribution (replaces the PEPT migration)

The reachable form of the intent. INCI attribution is derived at read time from
matchers, so *unattributed* peptides need no migration — Phase 1's new matchers
fix them automatically. What **is** persisted is wizard-confirmed
`activeTags`, so:

> A product tagged `copper_peptides` whose INCI contains no copper/GHK marker
> re-tags to `peptide_signal`.

Products with no INCI text keep `copper_peptides` — the user asserted it, and
absent evidence we do not silently downgrade a user's own tag.

This is narrower than the original task, because the false PEPT+vitamin C
conflicts it claims to remove never existed (report §1 #2).

### 8.4 Goal migration

`concerns` → `primaryGoal` + `goalNeedsConfirmation`, per the Phase 3 §3.1
table. Specified there; **executed here** so all v3 migrations land in one
place and the version bumps exactly once.

### 8.5 Version bump

`CURRENT_SCHEMA_VERSION` 2 → 3. **One** bump for this whole package —
Phases 3 and 8 must not each bump.

## Files

- `src/utils/routineEngine/migrations.ts` — peptide re-attribution, goal
  derivation, confirmation flags, version bump
- `src/types/index.ts` — `phototypeNeedsConfirmation`
- `src/store/profileStore.ts`, `src/store/productsStore.ts` — flags
- `src/screens/` — 6-card confirm, vitamin C wizard prompt

## Acceptance

- [ ] Legacy profile `type_3_4` → `fitzpatrick: 4` + `needsConfirmation`;
      prompt shown exactly once; engine used the strict branch before confirmation
- [ ] Product tagged `copper_peptides` with INCI "Palmitoyl Pentapeptide-4"
      → `peptide_signal`
- [ ] Product tagged `copper_peptides` with INCI "Copper Tripeptide-1" →
      unchanged
- [ ] Product tagged `copper_peptides` with **no INCI text** → unchanged
- [ ] `vitaminCAutoMigrated` product → prompt once; "derivative" re-tags and
      clears the flag
- [ ] `concerns: ['acne']` → `primaryGoal: 'acne'` + `goalNeedsConfirmation`
- [ ] Running migrations twice → no data changes **and same object references**
      (the existing idempotency contract, `migrations.ts:16`)
- [ ] `CURRENT_SCHEMA_VERSION === 3`, bumped once
- [ ] `migrations.test.ts` (12 KB, existing) still green
- [ ] `npx tsc --noEmit` clean
