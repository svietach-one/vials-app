/**
 * Shared fixtures for the onboarding-5-step-redesign feature (see
 * docs/tech-design/onboarding-5-step-redesign.md §1/§3, FE-1..FE-9).
 *
 * None of `OnboardingProgressRing` or the 5 `src/screens/onboarding/steps/*`
 * components exist yet, and `UserProfile` does not yet carry `hormoneTherapy`
 * / `pregnantOrBreastfeeding` (FE-1, schema v5→v6). Referencing them here is
 * expected to fail tsc/type-check the same way importing the not-yet-written
 * screens/components does in tests/contribution-consent/fixtures.ts — that is
 * expected red-before-green per .claude/rules/testing.md, not a mistake in
 * this file.
 *
 * Prop interfaces below are the CONTRACT the engineer must implement against
 * (tech design §3 FE-3..FE-8), declared locally the same way
 * tests/contribution-consent/fixtures.ts declares
 * `ContributionConsentMigrationBannerProps` rather than importing a type from
 * a module that doesn't exist yet. Once the engineer lands each component,
 * `<Component {...makeXProps()} />` call sites in the per-step test files
 * type-check the fixture's shape against the REAL exported prop type — so
 * any drift between this contract and what gets built still fails `tsc` at
 * the render call site, not just at runtime.
 */
import type {
  FitzpatrickType,
  SkinConcern,
  SkinConditionType,
  SkinGoal,
  SkinType,
  UserProfile,
} from '@/types';
import type { IconName } from '@/components/ui/Icon';

// ─── UserProfile (FE-1: adds hormoneTherapy / pregnantOrBreastfeeding) ─────────

export function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'local-user',
    gender: null,
    age: null,
    skinType: null,
    phototype: null,
    fitzpatrick: null,
    city: null,
    concerns: [],
    skinConditions: [],
    primaryGoal: 'maintenance',
    secondaryGoal: null,
    goalNeedsConfirmation: false,
    phototypeNeedsConfirmation: false,
    spfSensitivity: false,
    onboardingCompleted: false,
    individualDurationMonths: {},
    contributionConsent: { granted: false, timestamp: null },
    // FE-1: new optional safety-relevant fields, backfilled to `false` by
    // `migrateProfile` (schema v5→v6). These two lines are EXPECTED to fail
    // tsc ("Object literal may only specify known properties") until FE-1
    // adds them to `UserProfile` in src/types/index.ts.
    hormoneTherapy: false,
    pregnantOrBreastfeeding: false,
    ...overrides,
  };
}

// ─── OnboardingProgressRing (FE-3) ─────────────────────────────────────────────
// New component: src/components/onboarding/OnboardingProgressRing.tsx.
// Renders a react-native-svg arc sized by step/totalSteps, a centered Icon,
// and — the accessibility-parity requirement this task cares about — a
// sibling "Step N of M" text node.

export interface OnboardingProgressRingProps {
  step: number;
  totalSteps: number;
  iconName: IconName;
}

export function makeProgressRingProps(
  overrides: Partial<OnboardingProgressRingProps> = {},
): OnboardingProgressRingProps {
  return {
    step: 1,
    totalSteps: 5,
    iconName: 'droplet',
    ...overrides,
  };
}

// ─── SkinTypeStep (FE-4, step 1 of 5) ──────────────────────────────────────────
// Single-select FilterChip row (Oily/Dry/Combination/Normal). Next disabled
// until a value is chosen (tech design Assumption 7). First step — no Back.

export interface SkinTypeStepProps {
  initialSkinType: SkinType | null;
  onNext: (patch: Partial<UserProfile>) => void;
  onSkip: () => void;
}

export function makeSkinTypeStepProps(
  overrides: Partial<SkinTypeStepProps> = {},
): SkinTypeStepProps {
  return {
    initialSkinType: null,
    onNext: jest.fn(),
    onSkip: jest.fn(),
    ...overrides,
  };
}

// ─── GoalsStep (FE-5, step 2 of 5) ─────────────────────────────────────────────
// Wraps the existing GoalSelector unchanged (max-2 cap already built in).
// Next is never gated here (Assumption 7).

export interface GoalsStepProps {
  initialPrimaryGoal: SkinGoal;
  initialSecondaryGoal: SkinGoal | null;
  onNext: (patch: Partial<UserProfile>) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function makeGoalsStepProps(
  overrides: Partial<GoalsStepProps> = {},
): GoalsStepProps {
  return {
    initialPrimaryGoal: 'maintenance',
    initialSecondaryGoal: null,
    onNext: jest.fn(),
    onSkip: jest.fn(),
    onBack: jest.fn(),
    ...overrides,
  };
}

// ─── PhototypeStep (FE-6, step 3 of 5) ─────────────────────────────────────────
// Wraps the 6 existing FitzpatrickCards (resolved OQ-1 — 6 cards, not 3
// grouped cards) in a 2-column grid. Next disabled until a value is chosen.

export interface PhototypeStepProps {
  initialFitzpatrick: FitzpatrickType | null;
  onNext: (patch: Partial<UserProfile>) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function makePhototypeStepProps(
  overrides: Partial<PhototypeStepProps> = {},
): PhototypeStepProps {
  return {
    initialFitzpatrick: null,
    onNext: jest.fn(),
    onSkip: jest.fn(),
    onBack: jest.fn(),
    ...overrides,
  };
}

// ─── AboutYouStep (FE-7, step 4 of 5) ──────────────────────────────────────────
// Age Input, binary gender FilterChips (resolved OQ-2 — no "Other"), an
// always-visible caption, a divider, and a hormone-therapy Switch + helper.

export interface AboutYouStepProps {
  initialAge: number | null;
  initialGender: 'female' | 'male' | null;
  initialHormoneTherapy: boolean;
  onNext: (patch: Partial<UserProfile>) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function makeAboutYouStepProps(
  overrides: Partial<AboutYouStepProps> = {},
): AboutYouStepProps {
  return {
    initialAge: null,
    initialGender: null,
    initialHormoneTherapy: false,
    onNext: jest.fn(),
    onSkip: jest.fn(),
    onBack: jest.fn(),
    ...overrides,
  };
}

// ─── AdditionalInfoStep (FE-8, step 5 of 6) ────────────────────────────────────
// InlineAlert tone="warning" wraps the pregnancy/breastfeeding Switch in its
// `action` slot; SkinConcernsSelector (conditions + concerns) renders below.
// Footer button reads "Next" — CityStep (step 6) follows it.

export interface AdditionalInfoStepProps {
  initialPregnantOrBreastfeeding: boolean;
  initialSkinConditions: SkinConditionType[];
  initialConcerns: SkinConcern[];
  onNext: (patch: Partial<UserProfile>) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function makeAdditionalInfoStepProps(
  overrides: Partial<AdditionalInfoStepProps> = {},
): AdditionalInfoStepProps {
  return {
    initialPregnantOrBreastfeeding: false,
    initialSkinConditions: [],
    initialConcerns: [],
    onNext: jest.fn(),
    onSkip: jest.fn(),
    onBack: jest.fn(),
    ...overrides,
  };
}

// ─── SkinProfileSetupScreen navigation mock (FE-9) ─────────────────────────────
// Mirrors tests/contribution-consent/fixtures.ts's `as any` navigation-mock
// convention rather than constructing a full NativeStackScreenProps generic.

export interface SkinProfileSetupScreenNavigationMock {
  replace: jest.Mock;
}

export function makeSetupScreenNavigation(
  overrides: Partial<SkinProfileSetupScreenNavigationMock> = {},
): SkinProfileSetupScreenNavigationMock {
  return {
    replace: jest.fn(),
    ...overrides,
  };
}
