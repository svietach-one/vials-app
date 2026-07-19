import type { Product, Routine } from '@/types';
import { isScheduledOnDay } from '@/utils/routineSchedule';

/**
 * Pure builder for the Routine tab's month-matrix view (img-05).
 *
 * Rows are products that appear anywhere in the routine; columns are the days
 * of one month. Each cell says whether that product is scheduled that day in
 * the morning (AM) and/or the evening (PM) — the two halves the diagonal cell
 * renders.
 *
 * Schedule interpretation is delegated to {@link isScheduledOnDay}, the same
 * helper the Today checklist uses, so the grid can never disagree with the
 * list view about which days a step runs.
 */

export interface CalendarCellState {
  am: boolean;
  pm: boolean;
}

export interface CalendarRow {
  product: Product;
  /** One entry per day of the month, index 0 = the 1st. */
  cells: CalendarCellState[];
}

export interface CalendarMatrix {
  year: number;
  /** 0-indexed, matching Date#getMonth. */
  month: number;
  daysInMonth: number;
  rows: CalendarRow[];
}

/** Days in a month, leap years included (day 0 of the next month). */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Builds the matrix for the month containing `monthDate`.
 *
 * Exclusions mirror the list view exactly:
 *  - steps hidden from the routine (`step.hidden`)
 *  - steps whose product was deleted (dangling `productId`)
 *  - steps whose product is hidden from routines (`product.isHidden`)
 *
 * A product with no surviving step contributes no row at all. Row order is
 * first-appearance, morning routine before evening, which keeps the grid
 * stable as the schedule changes.
 */
export function buildCalendarMatrix(
  routines: Routine[],
  products: Product[],
  monthDate: Date,
): CalendarMatrix {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);

  const productById = new Map(products.map((p) => [p.id, p]));

  // Weekday for each day of the month, resolved once rather than per cell.
  const dayOfWeekByIndex: number[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    dayOfWeekByIndex.push(new Date(year, month, day).getDay());
  }

  const rowsByProductId = new Map<string, CalendarRow>();

  // Morning first, so AM-only products lead the grid in a predictable order.
  const ordered = [
    ...routines.filter((r) => r.timeOfDay === 'morning'),
    ...routines.filter((r) => r.timeOfDay === 'evening'),
  ];

  for (const routine of ordered) {
    const period = routine.timeOfDay === 'morning' ? 'am' : 'pm';

    for (const step of routine.steps) {
      if (step.hidden) continue;
      if (!step.productId) continue;

      const product = productById.get(step.productId);
      // Dangling reference (product deleted) or hidden from routines.
      if (!product || product.isHidden) continue;

      let row = rowsByProductId.get(product.id);
      if (!row) {
        row = {
          product,
          cells: Array.from({ length: daysInMonth }, () => ({ am: false, pm: false })),
        };
        rowsByProductId.set(product.id, row);
      }

      for (let i = 0; i < daysInMonth; i += 1) {
        if (isScheduledOnDay(step.scheduledDays, dayOfWeekByIndex[i])) {
          // OR-accumulate: a product scheduled by two steps in the same period
          // stays filled rather than being overwritten by the later step.
          row.cells[i][period] = true;
        }
      }
    }
  }

  return { year, month, daysInMonth, rows: [...rowsByProductId.values()] };
}
