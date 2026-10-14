# Technical Design: Metabolism Feedback Loop
Spec: docs/specs/metabolism-feedback-loop.md
Author: planner-agent
Date: 2026-10-14

## 1. Architecture Overview

Pure maths lives in a new util; cross-store writes live in a new domain module; screens only call domain actions.

```
ClinicScreen ──Move to history──▶ ProcedureDurationFeedbackModal ──▶ domain/procedureActions
AddProcedureModal.onSave ───────────────────────────────────────────▶   .logProcedure   (stamp expectedMonths)
ProcedureDetailScreen ── CalibrationCard ───────────────────────────▶   .archiveProcedure (realDuration + sample)
                                                                        .resetCalibration
domain/procedureActions ─▶ utils/metabolismCalibration (pure) ─▶ profileStore.updateProfile / proceduresStore
procedureLifespanHelpers.getTimelineConfig(proc) reads proc.expectedMonths (scales total + fade, rehab fixed)
```

- Baseline applies at **creation** (snapshot into `expectedMonths`), so recalibrating never shifts existing bars
  and a future manual lifespan edit writes the log field, never the profile.
- `forecastTimelineHelpers` and the lifespan card already go through `getTimelineConfig`; no change there.
- Persistence unchanged: `STORAGE_KEYS.profile` / `.procedures` via existing stores; schema v7 → v8.

## 2. API Contracts

N/A — no network. Module contracts:

```ts
// src/types/index.ts
export interface CalibrationEntry { months: number; samples: number }
UserProfile.individualDurationMonths: Partial<Record<CosmeticProcedureKey, CalibrationEntry>>
UserProcedureLog.expectedMonths?: number   // snapshot; absent = clinical default

// src/utils/metabolismCalibration.ts (pure, no React/stores)
MIN_REPORTED_MONTHS = 0.5; MAX_REPORTED_MONTHS = 60
validateReportedMonths(value: unknown): { ok: true; months: number } | { ok: false; reason: 'not_a_number'|'too_small'|'too_large' }
getBaselineMonths(key, individual): number                       // entry?.months ?? CLINICAL_RULES_DB[key].totalEffectMonths
applyCalibrationSample(key, reported, individual): Partial<Record<Key, CalibrationEntry>>   // returns NEW map; invalid → same map
scaleTimelineConfig(base: ClinicalTimelineConfig, expectedMonths: number): ClinicalTimelineConfig  // rehab fixed, fade ratio kept
formatMonths(n: number): string                                  // 1 decimal, trailing ".0" kept

// src/domain/procedureActions.ts
logProcedure(log: UserProcedureLog): void
archiveProcedure(id: string, reportedMonths: number | null): { status: 'skipped' | 'calibrated' | 'invalid'; from?: number; to?: number }
resetCalibration(key: CosmeticProcedureKey): void
```

## 3. Implementation Tasks

### engineer (scope=frontend)
- FE-1: Types: add `CalibrationEntry`, change `individualDurationMonths`, add `UserProcedureLog.expectedMonths`; fix test fixtures that annotate it — files: src/types/index.ts
- FE-2: `metabolismCalibration.ts` + co-located `metabolismCalibration.test.ts` (US-17 example 3.5/3.33/3.25, first-sample, invalid input, immutability, ratio scaling for all six keys, `now` not needed) — files: src/utils/metabolismCalibration.ts
- FE-3: `getTimelineConfig` applies `scaleTimelineConfig` when `proc.expectedMonths` is set (non-custom only); extend existing test file — files: src/utils/procedureLifespanHelpers.ts(.test.ts)
- FE-4: Migration v8: bump `CURRENT_SCHEMA_VERSION` to 8; `migrateProfile` coerces legacy number entries, returns same reference when nothing to change; extend `migrations.test.ts` — files: src/utils/routineEngine/migrations.ts(.test.ts)
- FE-5: Domain actions (reads both stores via `getState()`, mirrors `productActions.ts`); `archiveProcedure` validates, skips custom, archives even on skip, refuses (no write) on invalid — files: src/domain/procedureActions.ts
- FE-6: `ProcedureDurationFeedbackModal` (RadioOptionGroup + Input + Cancel/Confirm using RadioConfirmModal chrome; tokens only; default selection Skip; testIDs) — files: src/components/clinic/ProcedureDurationFeedbackModal.tsx
- FE-7: ClinicScreen: "Move to history" → open modal for non-custom, direct `archiveProcedure(id, null)` for custom; `onSave` → `logProcedure`; Toast on calibrated. Open the modal from the action sheet's close (iOS cannot present a Modal while another dismisses: set target in `onMoveToHistory`, show after `onClose`) — files: src/screens/ClinicScreen.tsx, src/components/clinic/ProcedureActionSheet.tsx (only if a hook is needed)
- FE-8: `CalibrationCard` on ProcedureDetailScreen (default vs yours, report Tag, empty InlineAlert, Reset via `Alert.alert` → `resetCalibration`) — files: src/components/clinic/CalibrationCard.tsx, src/screens/ProcedureDetailScreen.tsx
- FE-9: Route the flag-OFF "Mostly faded" confirm through `archiveProcedure` (new `onReportDuration` prop) so it can never stamp `realDuration` without calibrating; flag stays OFF — files: src/components/clinic/ProcedureLifespanCard.tsx
- FE-10: Docs: fix US-17 formula text; SCREENS.md Clinic section; progress files — files: docs/USER_STORIES.md, docs/SCREENS.md

### engineer (unit tests, both scopes)
- Each task above includes its own unit tests under `src/utils/*.test.ts`; domain action tests use real stores reset in `beforeEach`.

## 4. Assumptions

- `samples` counts real reports; the clinical default acts as one prior sample.
  Alternative: follow US-17 literally (`sampleCount` starts 0, weight 0).
  Reason: the literal formula yields 3.0 not 3.5 on the first report and contradicts the story's own example.
- Baseline is snapshotted into `UserProcedureLog.expectedMonths` at creation.
  Alternative: resolve the baseline live inside `getTimelineConfig` (needs profile access → impure util, bars jump on recalibration).
  Reason: keeps utils pure and existing bars stable; also the natural home for a future manual override.
- Calibration is stored, not re-derived from archived logs.
  Alternative: compute the average from `realDuration` of archived logs (no `samples` field; deleting a log would alter it).
  Reason: matches the requested storage shape and US-17; reset stays a simple delete.
- Fade point scales by the default `fadeTriggerMonth / totalEffectMonths` ratio; `rehabDays` is never calibrated.
  Alternative: store fade point separately. Reason: the user reports one number (total duration).
- Custom procedures are never calibrated or prompted.
  Alternative: calibrate by name. Reason: no stable category key; avoids fuzzy matching.
- Reported months bounded to 0.5–60 and rounded to 2 decimals on storage.
  Alternative: relative bounds per procedure. Reason: simple, absolute; SMAS default is 18.
- Binary reset confirmation uses native `Alert.alert`.
  Alternative: custom modal. Reason: multi-action-radio-picker ruling keeps binary/native dialogs native.

## 5. Open Questions

No open questions. (All spec §10 items approved 2026-10-14.)
