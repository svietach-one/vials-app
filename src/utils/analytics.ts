/**
 * Minimal, pluggable analytics seam. docs/tasks/explore_insights/07-analytics-events.md
 *
 * Does NOT pick a vendor and does NOT send anything over the network — it
 * only adds the seam so instrumentation exists at call sites and a real
 * provider can be wired in later by swapping the sink in one place
 * (`setAnalyticsSink`). Default sink: `__DEV__` console log, no-op otherwise.
 *
 * Hard privacy rule, enforced in the type below, not in a comment: no event
 * may carry ingredient text, product names, brand names, free text, or any
 * user-authored string — only counts, booleans, and closed enums. This
 * app's whole positioning is local-first and private; an event that phones
 * home with someone's INCI paste would contradict that outright. If a
 * future event needs a string, it must be a closed union of literals, never
 * a bare `string`.
 */
import type { ProductType } from '@/types';

export type AnalyticsEvent =
  | { name: 'explore_capture_started'; method: 'photo' | 'paste'; category: ProductType | null }
  | {
      name: 'explore_result_viewed';
      ingredientCount: number;
      activesCount: number;
      onePercentLineFound: boolean;
      shelfOverlapCount: number;
      hasSkinType: boolean;
      shelfSize: number;
    }
  | { name: 'explore_saved'; destination: 'shelf' | 'wishlist' }
  | { name: 'explore_skin_type_nudge_tapped' }
  | { name: 'explore_dismissed' };

type AnalyticsSink = (event: AnalyticsEvent) => void;

const defaultSink: AnalyticsSink = (event) => {
  if (__DEV__) console.log('[analytics]', event);
};

let sink: AnalyticsSink = defaultSink;

/** Swap the sink. Default sink: `__DEV__` console log, no-op otherwise. */
export function setAnalyticsSink(newSink: AnalyticsSink): void {
  sink = newSink;
}

/**
 * Fires `event` through the currently configured sink. Never throws and
 * never blocks the caller — a broken or slow analytics sink must not be
 * able to break a screen.
 */
export function trackEvent(event: AnalyticsEvent): void {
  try {
    sink(event);
  } catch (e) {
    if (__DEV__) console.warn('[analytics] sink threw', e);
  }
}
