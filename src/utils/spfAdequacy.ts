import type { FitzpatrickType, Product, Routine, SkinPhototype } from '@/types';
import { isScheduledOnDay } from '@/utils/routineSchedule';
import { getCurrentSeason } from '@/utils/timeHelpers';

/**
 * Phototype-aware SPF adequacy recommendation (PRD v1.2 §4.2.1, US-29).
 *
 * Unlike the condition and density layers, this rests on mainstream
 * dermatological consensus (SPF 30 baseline; 30–50+ commonly recommended for
 * Fitzpatrick I–II), so the copy is allowed to be more direct. It is still
 * informational: Cobalt, dismissible, and it blocks nothing.
 *
 * Three gates, all of which must pass, and any missing input means "can't
 * check" rather than "assume the worst":
 *   1. phototype is Light/Fair (Fitzpatrick 1–2) — v1 scope
 *   2. the current season is summer
 *   3. the lowest KNOWN spfValue among SPF products in the AM routine is < 30
 */

/** The consensus baseline this check measures against. */
export const SPF_ADEQUACY_THRESHOLD = 30;

export interface SpfAdequacyFinding {
  /** Lowest known SPF among the morning's SPF products. */
  lowestSpf: number;
  /** Name of the product carrying it, for the banner body. */
  productName: string;
  /** Recommended minimum. */
  threshold: number;
  message: string;
  /**
   * Season-and-year-scoped dismiss key (e.g. `spf-upgrade-summer-2026`), so
   * dismissing it this summer never suppresses it in a future one (US-29).
   */
  dismissKey: string;
}

interface SpfAdequacyInput {
  routines: Routine[];
  products: Product[];
  /** Numeric Fitzpatrick scale; the grouped field is accepted as a fallback. */
  fitzpatrick: FitzpatrickType | null;
  phototype?: SkinPhototype | null;
  /** Injected for testability — never read from the clock inside the check. */
  now?: Date;
}

/** True for the Light/Fair phototypes this check is scoped to in v1. */
function isLightPhototype(
  fitzpatrick: FitzpatrickType | null,
  phototype: SkinPhototype | null | undefined,
): boolean {
  if (fitzpatrick !== null) return fitzpatrick <= 2;
  return phototype === 'type_1_2';
}

export const SPF_ADEQUACY_TITLE = 'Sunscreen strength';

/** Copy is scanned by advisoryCopy.test.ts along with the advisory tables. */
export function buildSpfAdequacyMessage(lowestSpf: number): string {
  return (
    `Your scheduled sunscreen is SPF ${lowestSpf}. For light or fair skin during summer, ` +
    `dermatology guidelines generally recommend SPF ${SPF_ADEQUACY_THRESHOLD} or higher — ` +
    'many recommend SPF 50+ for regular outdoor exposure. Consider switching to a ' +
    'higher-SPF product.'
  );
}

/**
 * Returns the recommendation, or `null` when any gate fails: not a Light/Fair
 * phototype, not summer, no SPF product scheduled in the morning, or every
 * scheduled SPF product has an unknown `spfValue`.
 *
 * "No SPF scheduled at all" is deliberately NOT a finding here — it is tracked
 * as a separate, higher-priority story (US-29, out of scope).
 */
export function getSpfAdequacyFinding({
  routines,
  products,
  fitzpatrick,
  phototype = null,
  now = new Date(),
}: SpfAdequacyInput): SpfAdequacyFinding | null {
  if (!isLightPhototype(fitzpatrick, phototype)) return null;

  const season = getCurrentSeason(now);
  if (season !== 'summer') return null;

  const dayOfWeek = now.getDay();
  const morning = routines.filter((r) => r.timeOfDay === 'morning');

  let lowest: { spf: number; name: string } | null = null;
  for (const routine of morning) {
    for (const step of routine.steps) {
      if (step.hidden || !step.productId) continue;
      if (!isScheduledOnDay(step.scheduledDays, dayOfWeek)) continue;
      const product = products.find((p) => p.id === step.productId);
      if (!product || product.isHidden) continue;
      if (product.productType !== 'spf') continue;

      const spf = product.spfValue;
      // Unknown SPF means the product cannot be evaluated — never counted as
      // inadequate, and never allowed to suppress a lower known value either.
      if (spf === null || spf === undefined || !Number.isFinite(spf)) continue;
      if (lowest === null || spf < lowest.spf) lowest = { spf, name: product.name };
    }
  }

  if (lowest === null || lowest.spf >= SPF_ADEQUACY_THRESHOLD) return null;

  return {
    lowestSpf: lowest.spf,
    productName: lowest.name,
    threshold: SPF_ADEQUACY_THRESHOLD,
    message: buildSpfAdequacyMessage(lowest.spf),
    dismissKey: `spf-upgrade-${season}-${now.getFullYear()}`,
  };
}
