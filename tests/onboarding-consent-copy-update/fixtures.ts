/**
 * Shared fixtures for the onboarding-consent-copy-update feature (see
 * docs/tech-design/onboarding-consent-copy-update.md FE-3, spec Stories 1 & 2).
 *
 * MarketingSlidesScreen keeps every slide mounted inside its paging
 * ScrollView (existing, unchanged behaviour) — only the footer CTA's text
 * and disabled state depend on which slide is "active". `advanceToSlide`
 * simulates the paging ScrollView settling on a given slide by firing the
 * same `onMomentumScrollEnd` event the real ScrollView fires, using the
 * screen's own `useWindowDimensions()`-derived width so the index math
 * matches production exactly.
 */
import { Dimensions, ScrollView } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

// ─── Verbatim copy (spec §4 Story 1 ACs, §5 UX/Behaviour) ─────────────────────
// Kicker / headline / body / CTA text is given verbatim in the spec for all
// three slides (§4's Story 1 ACs previously deferred slide 1/2 body copy to
// §5, which didn't have it yet — the coordinator closed that gap in the spec
// on 2026-07-25; all three slides now assert full verbatim copy).

export const SLIDE1_KICKER = 'CARE THAT ASKS LESS OF YOU';
export const SLIDE1_HEADLINE = "Beauty isn't just about the right products.";
export const SLIDE1_BODY =
  "It's a system of small decisions and reminders you have to keep in mind. Let Vials hold that part — so your ritual keeps only what you actually enjoy.";
export const SLIDE1_CTA = 'Get started';

export const SLIDE2_KICKER = 'PRIVACY FIRST';
export const SLIDE2_HEADLINE = 'Your beauty secrets stay exactly that — yours.';
export const SLIDE2_BODY =
  'Your skin profile, routines, and procedure history stay on your device by default — nothing personal is uploaded unless you choose to. When you add a new product to your shelf, anonymous data about it joins the Vials database, so the catalog grows for the whole community.';
export const SLIDE2_CTA = 'Continue';

export const SLIDE3_KICKER = 'WARNINGS THAT ACTUALLY MATTER';
export const SLIDE3_BODY =
  'Instead of long lists of generic advice, Vials watches your own routine and warns you only about the combinations of products and procedures that actually apply to you.';
export const SLIDE3_CTA = 'Get started';

export const CONSENT_LABEL =
  "I understand Vials is a planning tool, not a medical app. It doesn't replace a consultation with a doctor or aesthetician, and it doesn't diagnose. Decisions about which products to use and procedures to undergo — and responsibility for their outcome, including possible allergic reactions — are mine to make.";

/**
 * The exact false claim from today's shipped slide 1 copy — the specific
 * factual inaccuracy this task exists to remove (spec Problem Statement /
 * Goal 1: contradicts the shipped crowdsourcing pipeline, PRD_Spec.md §4.3).
 */
export const OLD_FALSE_PRIVACY_CLAIM =
  'Everything you log — products, routines, procedures — is saved locally. No account, no cloud, no tracking. You own your data.';

export const CURRENT_MEDICAL_DISCLAIMER_VERSION = 1;

// ─── Navigation mock ────────────────────────────────────────────────────────

export interface MarketingSlidesNavigationMock {
  replace: jest.Mock;
}

export function makeMarketingSlidesNavigation(
  overrides: Partial<MarketingSlidesNavigationMock> = {},
): MarketingSlidesNavigationMock {
  return {
    replace: jest.fn(),
    ...overrides,
  };
}

// ─── Paging helper ──────────────────────────────────────────────────────────

/** 0-based slide index: 0 = value prop, 1 = privacy, 2 = warnings + consent. */
export function advanceToSlide(index: number) {
  const width = Dimensions.get('window').width;
  const scrollView = screen.UNSAFE_getByType(ScrollView);
  fireEvent(scrollView, 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: width * index } },
  });
}

export function advanceToConsentSlide() {
  advanceToSlide(2);
}
