import type { Product } from '@/types';
import { todayLocalIso } from '@/utils/dateInput';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface PaoStatus {
  daysRemaining: number;   // negative = already expired
  isExpired: boolean;      // daysRemaining < 0
  isExpiringSoon: boolean; // 0 ≤ daysRemaining ≤ 30
}

/**
 * Computes PAO expiry status relative to `now` (injectable for tests).
 * Both sides are calendar dates (UTC midnight of the date string vs. the
 * user's LOCAL today), so the count does not drift with the UTC offset.
 */
export function computePaoStatus(
  openedDate: string,
  paoMonths: number,
  now: Date = new Date(),
): PaoStatus {
  const opened = new Date(openedDate + 'T00:00:00.000Z');
  const expiry = new Date(opened);
  expiry.setUTCMonth(expiry.getUTCMonth() + paoMonths);

  const todayUTC = new Date(todayLocalIso(now) + 'T00:00:00.000Z');

  const daysRemaining = Math.ceil((expiry.getTime() - todayUTC.getTime()) / MS_PER_DAY);

  return {
    daysRemaining,
    isExpired: daysRemaining < 0,
    isExpiringSoon: daysRemaining >= 0 && daysRemaining <= 30,
  };
}

/** Returns null when the product has no PAO data or paoMonths is non-positive. */
export function getProductPaoStatus(product: Product): PaoStatus | null {
  if (!product.openedDate || !product.paoMonths || product.paoMonths <= 0) return null;
  return computePaoStatus(product.openedDate, product.paoMonths);
}
