/**
 * DD/MM/YYYY text ⇄ YYYY-MM-DD ISO conversion, shared by the clinic date
 * fields (AddProcedureModal, ProcedureDetailScreen). Pure — no React, no
 * store, `now` is injected where the current day matters.
 */

/** Parses DD/MM/YYYY → YYYY-MM-DD ISO date string, or null on failure. */
export function parseDateInput(text: string): string | null {
  const match = text.trim().replace(/\s/g, '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const d = parseInt(dd, 10);
  const m = parseInt(mm, 10);
  const y = parseInt(yyyy, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000) return null;
  const date = new Date(y, m - 1, d);
  // JS Date rolls overflow dates (e.g. April 31 → May 1); reject those
  if (isNaN(date.getTime()) || date.getDate() !== d || date.getMonth() + 1 !== m) return null;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/**
 * Today's date as YYYY-MM-DD in the LOCAL calendar. Not `toISOString()` (UTC)
 * and not the 04:00-boundary skincare day — a date field means the calendar
 * day the user sees on their clock. ISO dates compare correctly as strings.
 */
export function todayLocalIso(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Formats a YYYY-MM-DD ISO date string → DD/MM/YYYY for display in inputs. */
export function formatIsoToDateInput(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const [, yyyy, mm, dd] = match;
  return `${dd}/${mm}/${yyyy}`;
}
