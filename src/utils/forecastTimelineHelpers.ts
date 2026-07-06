import type { UserProcedureLog } from '@/types';
import {
  computeStatus,
  DAYS_PER_MONTH,
  getProcedureDisplayName,
  getTimelineConfig,
} from '@/utils/procedureLifespanHelpers';
import type { ComputedStatus } from '@/utils/procedureLifespanHelpers';

/**
 * Pure layout math for the Clinic forecast ribbon (ForecastTimeline).
 * Wraps procedureLifespanHelpers for all phase math — nothing is
 * reimplemented here; this module only projects dates onto a 12-column
 * calendar-month window. No React, store, or storage imports.
 */

export const FORECAST_WINDOW_MONTHS = 12;
/** Columns before the current month; current month sits at index 6 of 12. */
const MONTHS_BEFORE_CURRENT = 6;
const MS_PER_DAY = 86_400_000;

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export interface ForecastMonthColumn {
  key: string;
  label: string;
  year: number;
  isCurrent: boolean;
}

export interface ForecastTrack {
  procedureId: string;
  displayName: string;
  status: ComputedStatus;
  row: number;
  /** Month-units from the window start, clamped to [0, 12]. */
  startOffset: number;
  fadeOffset: number;
  endOffset: number;
}

export interface ForecastTimelineData {
  months: ForecastMonthColumn[];
  tracks: ForecastTrack[];
  rowCount: number;
}

/** First day of the earliest month in the window (6 months before `now`'s). */
function getWindowStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() - MONTHS_BEFORE_CURRENT, 1);
}

function buildMonthColumns(now: Date): ForecastMonthColumn[] {
  const start = getWindowStart(now);
  return Array.from({ length: FORECAST_WINDOW_MONTHS }, (_, index) => {
    const monthDate = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return {
      key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
      label: MONTH_SHORT[monthDate.getMonth()],
      year: monthDate.getFullYear(),
      isCurrent: index === MONTHS_BEFORE_CURRENT,
    };
  });
}

/**
 * Fractional month-column offset of a date from the window start (unclamped,
 * may be negative or above 12). Whole part = calendar-month index; fractional
 * part = day position within that calendar month, so a track's x-position
 * always lines up with the month column headers regardless of month length.
 */
function dateToOffset(date: Date, windowStart: Date): number {
  const monthsDiff =
    (date.getFullYear() - windowStart.getFullYear()) * 12 +
    (date.getMonth() - windowStart.getMonth());
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return monthsDiff + (date.getDate() - 1) / daysInMonth;
}

function clampToWindow(offset: number): number {
  return Math.min(Math.max(offset, 0), FORECAST_WINDOW_MONTHS);
}

/**
 * Span for one procedure: datePerformed → fadeTriggerMonth → totalEffectMonths
 * (per getTimelineConfig, 30.44-days-per-month convention), clipped silently
 * to the window. Returns null when the span falls fully outside the window.
 */
function buildTrack(
  proc: UserProcedureLog,
  windowStart: Date,
  now: Date,
): ForecastTrack | null {
  const config = getTimelineConfig(proc);
  const performed = new Date(proc.datePerformed);
  const monthsToMs = (months: number) => months * DAYS_PER_MONTH * MS_PER_DAY;
  const fadeDate = new Date(performed.getTime() + monthsToMs(config.fadeTriggerMonth));
  const endDate = new Date(performed.getTime() + monthsToMs(config.totalEffectMonths));

  const rawStart = dateToOffset(performed, windowStart);
  const rawEnd = dateToOffset(endDate, windowStart);
  if (rawEnd <= 0 || rawStart >= FORECAST_WINDOW_MONTHS) return null;

  return {
    procedureId: proc.id,
    displayName: getProcedureDisplayName(proc),
    status: computeStatus(proc, now),
    row: 0,
    startOffset: clampToWindow(rawStart),
    fadeOffset: clampToWindow(dateToOffset(fadeDate, windowStart)),
    endOffset: clampToWindow(rawEnd),
  };
}

/**
 * Greedy interval partitioning: sort by startOffset, place each track in the
 * first row whose previous track has already ended (touching endpoints do not
 * overlap), else open a new row. Deterministic tie-breaks keep the output
 * stable for identical inputs.
 */
function assignRows(tracks: ForecastTrack[]): ForecastTrack[] {
  const sorted = [...tracks].sort(
    (a, b) =>
      a.startOffset - b.startOffset ||
      a.endOffset - b.endOffset ||
      a.procedureId.localeCompare(b.procedureId),
  );
  const rowEnds: number[] = [];
  return sorted.map((track) => {
    let row = rowEnds.findIndex((end) => track.startOffset >= end);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(track.endOffset);
    } else {
      rowEnds[row] = track.endOffset;
    }
    return { ...track, row };
  });
}

/**
 * Builds the full ribbon model: 12 month columns (6 past + current + 5
 * future), one clipped track per non-archived procedure intersecting the
 * window, and greedy row assignment for overlaps. Pure and deterministic —
 * `now` is always injected.
 */
export function buildForecastTimeline(
  procedures: UserProcedureLog[],
  now: Date,
): ForecastTimelineData {
  const windowStart = getWindowStart(now);
  const clippedTracks = procedures
    .filter((proc) => proc.status !== 'archived')
    .map((proc) => buildTrack(proc, windowStart, now))
    .filter((track): track is ForecastTrack => track !== null);
  const tracks = assignRows(clippedTracks);
  const rowCount = tracks.reduce((max, track) => Math.max(max, track.row + 1), 0);
  return { months: buildMonthColumns(now), tracks, rowCount };
}
