/**
 * Component tests — Surface B (clinic), PREGNANCY_SAFETY_ENABLED OFF (the
 * real shipped default — @/constants/featureFlags is NOT mocked here).
 * Spec: docs/specs/pregnancy-safety-handling.md §4 Story 3 AC5 (flag half)
 * Tech design: docs/tech-design/pregnancy-safety-handling.md §3 FE-9
 *
 * Proves `ConflictEngine.checkPregnancyConflict` stays inert under the
 * ACTUAL shipped configuration, mirroring the pregnancy-freeze-disabled.test.ts
 * guard-rail style for Surface A.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

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
import { PREGNANCY_SAFETY_ENABLED } from '@/constants/featureFlags';
import type { CosmeticProcedureKey } from '@/types';
import { PROCEDURE_LABELS } from '@/utils/procedureLifespanHelpers';
import { makeAddProcedureModalProps, makeModalProfile } from './fixtures';

function renderModal() {
  render(<AddProcedureModal {...makeAddProcedureModalProps()} />);
}

function selectProcedure(key: CosmeticProcedureKey) {
  fireEvent.press(screen.getByText(PROCEDURE_LABELS[key]));
}

function pregnancyAlertCalls() {
  return (InlineAlert as jest.Mock).mock.calls.filter(([props]) =>
    /pregnan|breastfeed/i.test(String(props.children ?? '')),
  );
}

beforeEach(() => {
  (InlineAlert as jest.Mock).mockClear();
});

describe('Guard rail: PREGNANCY_SAFETY_ENABLED ships off pending clinical sign-off (spec §10)', () => {
  it('is false', () => {
    expect(PREGNANCY_SAFETY_ENABLED).toBe(false);
  });
});

describe('Story 3 AC5: no pregnancy advisory renders while the flag is off, regardless of the profile', () => {
  it.each<CosmeticProcedureKey>([
    'botox',
    'fillers',
    'smas_lifting',
    'mesotherapy',
    'chemical_peel_deep',
    'mechanical_facial',
  ])('renders no pregnancy-related InlineAlert for %s with a pregnant profile', (key) => {
    // Arrange
    mockProfile = makeModalProfile({ pregnantOrBreastfeeding: true });
    renderModal();

    // Act
    selectProcedure(key);

    // Assert
    expect(pregnancyAlertCalls()).toHaveLength(0);
  });
});
