/**
 * Fixtures for the clinic-forecast-timeline suite.
 *
 * Spec:        docs/specs/clinic-forecast-timeline.md
 * Tech design: docs/tech-design/clinic-forecast-timeline.md
 *
 * ── TestID / accessibility contract (picked by qa-lead, APPROVED by coordinator
 *    2026-07-06 — the engineer MUST implement `ForecastTimeline.tsx` against
 *    this exact contract, not a guess; the tech design left these names
 *    unspecified) ──────────────────────────────────────────────────────────
 *
 * Root:
 *   - testID="forecast-timeline"                    the outer ScrollView/wrapper
 *   - testID="forecast-month-header"                 the 12-column header row
 *
 * Month columns (one per ForecastMonthColumn, in window order 0..11):
 *   - testID={`forecast-month-${index}`}             index is 0-based position
 *     in the 12-column window (6 past + current @ index 6 + 5 future)
 *   - accessibilityLabel={`${label} ${year}`}         e.g. "Jul 2026"
 *   - accessibilityState={{ selected: isCurrent }}    non-style "current month
 *     marked" signal — the only column with `selected: true` is the current one
 *
 * Rows (one container per lane returned by buildForecastTimeline):
 *   - testID={`forecast-row-${row}`}                  wraps every track whose
 *     ForecastTrack.row === row; two overlapping procedures must resolve to
 *     two different row testIDs, never the same one
 *
 * Tracks (one per ForecastTrack):
 *   - testID={`forecast-track-${procedureId}`}
 *   - accessibilityRole="button"
 *   - accessibilityLabel including the display name (getProcedureDisplayName)
 *     AND a phase word matching /active|fading|rehab|completed/i
 *   - onPress calls onSelectProcedure(procedureId) exactly once
 *
 * Segments (children of each track):
 *   - testID={`forecast-segment-${procedureId}-cobalt`}
 *   - testID={`forecast-segment-${procedureId}-amber`}
 *   Both must be present for every non-archived, in-window track — this repo
 *   draws exactly 2 segments (Assumption 2 in the tech design), no 3rd rehab
 *   segment.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { UserProcedureLog } from '@/types';
// NOTE: this import intentionally targets code that does not exist yet.
// It will fail to resolve until the engineer creates
// src/components/clinic/ForecastTimeline.tsx — that failure is expected
// (tests-first) and is called out in progress/clinic-forecast-timeline.md.
// Importing the real prop type here means `tsc` will catch any prop-shape
// drift the moment the component lands, instead of only at test-run time.
import type { ForecastTimelineProps } from '@/components/clinic/ForecastTimeline';

// ─── Fixed "now" — never real dates ──────────────────────────────────────────

/**
 * Window for this NOW (6 before + current + 5 after, per tech design
 * Assumption 1): index0=Jan26 .. index6=Jul26 (current) .. index11=Dec26.
 * No year rollover — kept deliberately simple; rollover edge cases (now in
 * Nov/Dec) are covered by the engineer's `buildForecastTimeline` unit tests
 * (FE-4), not here.
 */
export const NOW = new Date('2026-07-06T12:00:00');

// ─── UserProcedureLog factory ────────────────────────────────────────────────

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `proc-${idCounter}`;
}

export function makeProcedureLog(overrides: Partial<UserProcedureLog> = {}): UserProcedureLog {
  return {
    id: nextId(),
    procedureKey: 'botox',
    datePerformed: '2026-06-01',
    status: 'active',
    deferralCount: 0,
    ...overrides,
  };
}

// ─── Named fixtures used across the suite ────────────────────────────────────

/** Performed 2026-06-01 — 35 days before NOW, well inside the window, active. */
export const BOTOX_ACTIVE = makeProcedureLog({
  id: 'botox-active',
  procedureKey: 'botox',
  datePerformed: '2026-06-01',
  status: 'active',
});

/** Performed 2026-06-15 — overlaps BOTOX_ACTIVE's effect span. */
export const FILLERS_OVERLAP = makeProcedureLog({
  id: 'fillers-overlap',
  procedureKey: 'fillers',
  datePerformed: '2026-06-15',
  status: 'active',
});

/** Performed 2026-06-20 — overlaps both of the above (3-way overlap fixture). */
export const SMAS_OVERLAP = makeProcedureLog({
  id: 'smas-overlap',
  procedureKey: 'smas_lifting',
  datePerformed: '2026-06-20',
  status: 'active',
});

/** Short-lived (1 month), fully resolved well before FILLERS_LATE starts. */
export const MECHANICAL_EARLY = makeProcedureLog({
  id: 'mechanical-early',
  procedureKey: 'mechanical_facial',
  datePerformed: '2026-01-05',
  status: 'active',
});

/** Starts near the window's far end — does not overlap MECHANICAL_EARLY. */
export const FILLERS_LATE = makeProcedureLog({
  id: 'fillers-late',
  procedureKey: 'fillers',
  datePerformed: '2026-11-01',
  status: 'active',
});

/** Entirely before the window (Jan/Feb 2023) — must be dropped, not clipped. */
export const OUTSIDE_WINDOW = makeProcedureLog({
  id: 'outside-window',
  procedureKey: 'mechanical_facial',
  datePerformed: '2023-01-01',
  status: 'active',
});

/** Starts before the window (Sep 2025), fillers run 12 months -> clips at start. */
export const CLIPPED_AT_START = makeProcedureLog({
  id: 'clipped-start',
  procedureKey: 'fillers',
  datePerformed: '2025-09-01',
  status: 'active',
});

/** Starts inside the window (Jun 2026), smas runs 18 months -> clips at end. */
export const CLIPPED_AT_END = makeProcedureLog({
  id: 'clipped-end',
  procedureKey: 'smas_lifting',
  datePerformed: '2026-06-01',
  status: 'active',
});

/** Archived — must never produce a track, even passed directly to the component. */
export const ARCHIVED_PROC = makeProcedureLog({
  id: 'archived-proc',
  procedureKey: 'botox',
  datePerformed: '2026-05-01',
  status: 'archived',
});

/** Custom procedure — config derived from estimatedReturnDate, not CLINICAL_RULES_DB. */
export const CUSTOM_PROC = makeProcedureLog({
  id: 'custom-proc',
  procedureKey: 'custom',
  customName: 'Laser Resurfacing',
  datePerformed: '2026-05-01',
  estimatedReturnDate: '2026-11-01',
  customRehabDays: 5,
  status: 'active',
});

// ─── ForecastTimelineProps factory (typed against the real, not-yet-built props) ──

export function makeForecastTimelineProps(
  overrides: Partial<ForecastTimelineProps> = {},
): ForecastTimelineProps {
  return {
    procedures: [BOTOX_ACTIVE],
    onSelectProcedure: () => {},
    now: NOW,
    ...overrides,
  };
}
