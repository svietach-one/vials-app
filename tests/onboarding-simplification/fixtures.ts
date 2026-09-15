/**
 * Shared fixtures for the onboarding-simplification feature (see
 * docs/tech-design/onboarding-simplification.md).
 *
 * `GrowDatabasePromptModal` (FE-3) and `AddProductOptionsList` (FE-7) do not
 * exist yet at the time these tests are written; the rewritten
 * `FirstProductScreen` (FE-8) and the `entryContext` navigation param
 * (FE-5/FE-6) don't exist yet either. Importing/using them here is expected
 * red-before-green per .claude/rules/testing.md — the same convention this
 * repo already follows in tests/contribution-consent/fixtures.ts and
 * tests/onboarding-5-step-redesign/fixtures.ts.
 *
 * Prop interfaces declared locally below (GrowDatabasePromptModalProps,
 * AddProductOptionsListProps) are the CONTRACT the engineer implements
 * against per tech design §3 FE-3/FE-7, not a re-export of a real type that
 * doesn't exist yet — the same pattern
 * tests/contribution-consent/fixtures.ts uses for
 * `ContributionConsentMigrationBannerProps`.
 */
import type { ContributionConsent, ProductStatus, UserProfile } from '@/types';
import type { CorpusProduct } from '@/services/corpus/types';

// ─── contributionConsent / UserProfile ─────────────────────────────────────────

export function makeContributionConsent(
  overrides: Partial<ContributionConsent> = {},
): ContributionConsent {
  return { granted: false, timestamp: null, ...overrides };
}

export function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'local-user',
    gender: null,
    age: null,
    skinType: null,
    phototype: null,
    fitzpatrick: null,
    city: null,
    skinConditions: [],
    concerns: [],
    primaryGoal: 'maintenance',
    secondaryGoal: null,
    goalNeedsConfirmation: false,
    phototypeNeedsConfirmation: false,
    spfSensitivity: false,
    onboardingCompleted: false,
    individualDurationMonths: {},
    contributionConsent: makeContributionConsent(),
    hormoneTherapy: false,
    pregnantOrBreastfeeding: false,
    sensitive: false,
    ...overrides,
  };
}

// ─── CorpusProduct (search results) ────────────────────────────────────────────

export function makeCorpusProduct(overrides: Partial<CorpusProduct> = {}): CorpusProduct {
  return {
    uid: 'corpus-1',
    barcode: null,
    brand: 'CeraVe',
    name: 'Foaming Facial Cleanser',
    type: 'cleanser',
    inciRaw: 'Aqua, Glycerin',
    imageUrl: null,
    source: 'vials_seed',
    url: null,
    nameLacin: null,
    ...overrides,
  };
}

// ─── Generic navigation mock ────────────────────────────────────────────────────
// Cast `as any`/`as never` at the call site, mirroring this repo's established
// convention for screens whose route/param types are mid-change (see
// tests/contribution-consent/fixtures.ts, tests/onboarding-5-step-redesign/fixtures.ts).

export interface SimpleNavigationMock {
  navigate: jest.Mock;
  replace: jest.Mock;
  goBack: jest.Mock;
}

export function makeNavigation(overrides: Partial<SimpleNavigationMock> = {}): SimpleNavigationMock {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
    ...overrides,
  };
}

// ─── GrowDatabasePromptModal (FE-3) — contract only, component doesn't exist ───
// Tech design §3 FE-3: "identical copy/2-button layout ... props { visible,
// onAgree, onNotNow }". Copy is identical to today's ContributionConsentScreen
// (spec §5: "same 3-paragraph copy and 2-button layout as today's screen").

export interface GrowDatabasePromptModalProps {
  visible: boolean;
  onAgree: () => void;
  onNotNow: () => void;
}

export function makeGrowDatabasePromptModalProps(
  overrides: Partial<GrowDatabasePromptModalProps> = {},
): GrowDatabasePromptModalProps {
  return {
    visible: true,
    onAgree: jest.fn(),
    onNotNow: jest.fn(),
    ...overrides,
  };
}

export const GROW_DATABASE_PROMPT_TITLE = 'Help grow the Vials database';

export const GROW_DATABASE_PROMPT_BODY_PARAGRAPHS = [
  "When you add a product we don't recognize, you can choose to share it with the Vials community — so the next person who scans it gets instant results too.",
  'Sharing includes the product photo and details you enter. No personal data, location, or device info is ever included.',
  "A person reviews every submission before it's added. You can change this anytime in Settings.",
];

// ─── AddProductOptionsList (FE-7) — contract only, component doesn't exist ─────
// Tech design §3 FE-7: extracted from AddProductHubScreen's body, "taking
// (navigation, initialStatus?, entryContext?)".

export interface AddProductOptionsListProps {
  navigation: SimpleNavigationMock;
  initialStatus?: ProductStatus;
  entryContext?: 'catalog' | 'onboarding';
}

export function makeAddProductOptionsListProps(
  overrides: Partial<AddProductOptionsListProps> = {},
): AddProductOptionsListProps {
  return {
    navigation: makeNavigation(),
    ...overrides,
  };
}

// ─── react-native-svg stub ──────────────────────────────────────────────────────
// Needed wherever OnboardingProgressRing renders (inside the real
// SkinProfileSetupScreen) — mirrors
// tests/onboarding-5-step-redesign/SkinProfileSetupScreen.test.tsx's mock
// exactly, including the "real own properties, not just a Proxy `get` trap"
// requirement for lucide-react-native's namespace-import enumeration.
// Declared as a factory (not applied here) because `jest.mock` factories must
// be called directly from the test file that uses them. Uses
// `React.createElement` rather than JSX since this file has a `.ts`
// extension (per .claude/rules/testing.md's `fixtures.ts` convention), and
// JSX syntax is invalid in a non-`.tsx` file.
export function mockReactNativeSvgFactory() {
  const React = require('react');
  const { View } = require('react-native');
  const stub = (name: string) => {
    const Stub = (props: Record<string, unknown>) =>
      React.createElement(View, { testID: (props.testID as string) ?? `svg-${name}` });
    Stub.displayName = name;
    return Stub;
  };
  const KNOWN_EXPORTS = [
    'Svg', 'Circle', 'Path', 'Line', 'Rect', 'Polyline', 'Polygon', 'Ellipse',
    'G', 'Defs', 'ClipPath', 'Mask', 'LinearGradient', 'RadialGradient',
    'Stop', 'Use', 'Symbol', 'Text', 'TSpan',
  ];
  const target: Record<string, unknown> = { __esModule: true, default: stub('Svg') };
  KNOWN_EXPORTS.forEach((name) => {
    target[name] = stub(name);
  });
  return new Proxy(target, {
    get: (t: Record<string, unknown>, prop: string) => (prop in t ? t[prop] : stub(prop)),
  });
}
