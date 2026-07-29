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
