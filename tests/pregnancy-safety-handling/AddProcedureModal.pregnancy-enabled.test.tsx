/**
 * Component tests — Surface B (clinic), PREGNANCY_SAFETY_ENABLED ON.
 * Spec: docs/specs/pregnancy-safety-handling.md §4 Story 3 (AC1-4)
 * Tech design: docs/tech-design/pregnancy-safety-handling.md §3 FE-8/FE-9/FE-10
 *
 * `ConflictEngine.checkPregnancyConflict`, `PREGNANCY_PROCEDURE_SEVERITY`, and
 * the modal's fourth `pregnancyResult`/InlineAlert do not exist yet — this
 * file is EXPECTED to fail to compile/run until FE-8..FE-10 land
 * (qa-lead writes tests before code, .claude/rules/testing.md).
 *
 * `InlineAlert` is spied on with its REAL implementation kept
 * (`jest.requireActual` wrapped in `jest.fn`, mirroring
 * tests/onboarding-5-step-redesign/AdditionalInfoStep.test.tsx) so tone/
 * content assertions read the actual props passed to it, rather than
 * reaching into internal styles. Severity tiers ARE locked by tech design
 * FE-8 (avoid for botox/fillers/smas_lifting/mesotherapy/chemical_peel_deep,
 * caution for mechanical_facial), so tone is asserted precisely; the exact
 * explanation/suggestion copy is draft text pending clinical review (spec
 * §10) and is only matched loosely (mentions pregnancy/breastfeeding),
 * never asserted verbatim.
 *
 * Mock-history bookkeeping note (2026-07-29 qa-lead follow-up): the modal's
 * default selection is the hardcoded `'botox'`, which is itself avoid-severity
 * per FE-8's own table, so a pregnant profile always fires one real,
 * expected `InlineAlert` call on mount before any test interacts with the
 * picker. `beforeEach`'s `mockClear()` runs before `renderModal()`, so that
 * mount-time call is never cleared automatically — tests that care about
 * only the alert produced by a specific `selectProcedure()` call clear the
 * mock again right after `renderModal()`. The one exception is re-selecting
 * `'botox'` itself: since it's already the active state, pressing it again
 * is a React no-op (`Object.is` bails out of the state update, no re-render,
 * no new `InlineAlert` call), so that case asserts directly against the
 * mount-time call instead of clearing it away. See progress/
 * pregnancy-safety-handling.md's 2026-07-29 engineer/tech-lead log entries
 * for the full root-cause analysis this fix is based on.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@/constants/featureFlags', () => ({
  ...jest.requireActual('@/constants/featureFlags'),
  PREGNANCY_SAFETY_ENABLED: true,
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

jest.mock('@/components/ui/feedback/InlineAlert', () => {
  const actual = jest.requireActual('@/components/ui/feedback/InlineAlert');
  return { ...actual, InlineAlert: jest.fn(actual.InlineAlert) };
});

let mockProfile: import('@/types').UserProfile | null = null;
jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: mockProfile })),
}));

import { AddProcedureModal } from '@/components/clinic/AddProcedureModal';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import type { CosmeticProcedureKey } from '@/types';
import { PROCEDURE_LABELS } from '@/utils/procedureLifespanHelpers';
import { makeAddProcedureModalProps, makeModalProfile } from './fixtures';

function renderModal() {
  render(<AddProcedureModal {...makeAddProcedureModalProps()} />);
}

function selectProcedure(key: CosmeticProcedureKey) {
  fireEvent.press(screen.getByText(PROCEDURE_LABELS[key]));
}

/** Alert calls whose rendered content is pregnancy/breastfeeding-specific. */
function pregnancyAlertCalls(tone?: 'sos' | 'warning') {
  return (InlineAlert as jest.Mock).mock.calls.filter(
    ([props]) =>
      (tone === undefined || props.tone === tone) &&
      /pregnan|breastfeed/i.test(String(props.children ?? '')),
  );
}

beforeEach(() => {
  (InlineAlert as jest.Mock).mockClear();
  mockProfile = makeModalProfile({ pregnantOrBreastfeeding: true });
});

describe('Story 3 AC1: avoid-severity procedures render an avoid-tone pregnancy advisory', () => {
  it.each<CosmeticProcedureKey>([
    'botox',
    'fillers',
    'smas_lifting',
    'mesotherapy',
    'chemical_peel_deep',
  ])('renders exactly one sos-tone pregnancy InlineAlert for %s', (key) => {
    // Arrange
    renderModal();
    // The mount-time alert (default selection 'botox', itself avoid-severity)
    // is real and expected. Isolate the alert produced by this test's own
    // selection by clearing it here — except for the 'botox' case itself,
    // where re-selecting the already-active default is a no-op re-render
    // (no fresh InlineAlert call to isolate), so the mount-time call IS the
    // one under test.
    if (key !== 'botox') {
      (InlineAlert as jest.Mock).mockClear();
    }

    // Act
    selectProcedure(key);

    // Assert
    expect(pregnancyAlertCalls('sos')).toHaveLength(1);
  });
});

describe('Story 3 AC2: mechanical_facial renders a caution-tone pregnancy advisory', () => {
  it('renders exactly one warning-tone pregnancy InlineAlert', () => {
    // Arrange
    renderModal();
    // Clear the mount-time botox (sos) alert so this test isolates only the
    // alert produced by selecting mechanical_facial.
    (InlineAlert as jest.Mock).mockClear();

    // Act
    selectProcedure('mechanical_facial');

    // Assert
    expect(pregnancyAlertCalls('warning')).toHaveLength(1);
    expect(pregnancyAlertCalls('sos')).toHaveLength(0);
  });
});

describe('Story 3 AC3: the pregnancy advisory renders alongside another applicable advisory, not in place of it', () => {
  it('shows both the pregnancy avoid alert and the phototype caution alert for a deep peel on a medium/dark phototype', () => {
    // Arrange — phototype (not season) drives the second alert deterministically,
    // independent of the real device date.
    mockProfile = makeModalProfile({ pregnantOrBreastfeeding: true, phototype: 'type_5_6' });
    renderModal();
    // Clear the mount-time botox (sos) alert so the count below isolates only
    // the alert produced by selecting chemical_peel_deep.
    (InlineAlert as jest.Mock).mockClear();

    // Act
    selectProcedure('chemical_peel_deep');

    // Assert
    expect(pregnancyAlertCalls('sos')).toHaveLength(1);
    const phototypeCall = (InlineAlert as jest.Mock).mock.calls.find(
      ([props]) => props.title === 'Skin tone consideration',
    );
    expect(phototypeCall).toBeDefined();
  });
});

describe('Story 3 AC4: a custom procedure runs no clinical checks at all, pregnancy included', () => {
  it('renders no pregnancy advisory once "Custom Procedure" is selected', () => {
    // Arrange
    renderModal();
    // Clear the mount-time botox (sos) alert — otherwise it lingers in the
    // mock history and the assertion below would see 1 instead of 0.
    (InlineAlert as jest.Mock).mockClear();

    // Act
    fireEvent.press(screen.getByText('Custom Procedure'));

    // Assert
    expect(pregnancyAlertCalls()).toHaveLength(0);
  });
});

describe('Story 3 AC5 (profile half): no pregnancy advisory when the profile flag is false, even with the feature flag on', () => {
  it('renders nothing pregnancy-related for a non-pregnant profile', () => {
    // Arrange
    mockProfile = makeModalProfile({ pregnantOrBreastfeeding: false });
    renderModal();

    // Act
    selectProcedure('botox');

    // Assert
    expect(pregnancyAlertCalls()).toHaveLength(0);
  });
});
