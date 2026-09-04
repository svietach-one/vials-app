/**
 * Component test — AllergenBadge (FE-4)
 * Spec: docs/specs/vials-eu-allergen-detection.md Story 1 + Story 2 acceptance criteria.
 * Tech design: docs/tech-design/vials-eu-allergen-detection.md FE-4.
 *
 * `src/components/ui/AllergenBadge.tsx` does not exist yet — this whole suite is
 * EXPECTED TO FAIL to resolve ("Cannot find module") until the engineer lands FE-4,
 * the same "test the not-yet-built component directly" pattern used across this
 * codebase's other pre-implementation qa-lead suites (e.g. multi-active-badges'
 * src/utils/activeBadges.ts before it existed).
 *
 * Binding testID/behavior contract this suite establishes for the engineer:
 *   - testID="allergen-badge" on the rendered badge container; absent entirely
 *     (not an empty/hidden node) when there are zero matches.
 *   - Fixed 28×28 size, "A" glyph text.
 *   - accessibilityLabel differs between the restricted and non-restricted case
 *     — exact copy is left to the engineer, only the distinguishing behavior
 *     (and, separately, the neutral-copy contract on ProductDetailScreen, see
 *     ProductDetailScreen.allergens-card.test.tsx) is contractual here.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AllergenBadge } from '@/components/ui/AllergenBadge';
import { colors } from '@/constants/tokens';

import {
  NON_RESTRICTED_MATCH_A,
  NON_RESTRICTED_MATCH_B,
  RESTRICTED_MATCH_LILIAL,
  RESTRICTED_MATCH_LYRAL,
} from './fixtures';

function flattenStyle(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

describe('Story 1 AC1 — Cobalt badge for >=1 non-restricted match', () => {
  it('renders a single "A" badge with testID allergen-badge', () => {
    render(<AllergenBadge matches={[NON_RESTRICTED_MATCH_A]} />);
    expect(screen.getByTestId('allergen-badge')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('renders the badge in Cobalt (statusInfoTint) fill when every match is non-restricted', () => {
    render(<AllergenBadge matches={[NON_RESTRICTED_MATCH_A, NON_RESTRICTED_MATCH_B]} />);
    const badge = flattenStyle(screen.getByTestId('allergen-badge').props.style);
    expect(badge.backgroundColor).toBe(colors.statusInfoTint);
  });

  it('renders a fixed 28x28 circular badge', () => {
    render(<AllergenBadge matches={[NON_RESTRICTED_MATCH_A]} />);
    const badge = flattenStyle(screen.getByTestId('allergen-badge').props.style);
    expect(badge.width).toBe(28);
    expect(badge.height).toBe(28);
  });
});

describe('Story 1 AC2/AC3 — no badge at all when there are zero matches', () => {
  it('renders nothing (not an empty node) when matches is an empty array', () => {
    const { toJSON } = render(<AllergenBadge matches={[]} />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByTestId('allergen-badge')).toBeNull();
  });
});

describe('Story 2 AC1 — Amber badge takes precedence when any match is restricted', () => {
  it('renders Amber (statusWarningTint) when the only match is restricted', () => {
    render(<AllergenBadge matches={[RESTRICTED_MATCH_LILIAL]} />);
    const badge = flattenStyle(screen.getByTestId('allergen-badge').props.style);
    expect(badge.backgroundColor).toBe(colors.statusWarningTint);
  });

  it('renders Amber even when non-restricted matches are also present on the same product', () => {
    render(
      <AllergenBadge
        matches={[NON_RESTRICTED_MATCH_A, RESTRICTED_MATCH_LILIAL, NON_RESTRICTED_MATCH_B]}
      />,
    );
    const badge = flattenStyle(screen.getByTestId('allergen-badge').props.style);
    expect(badge.backgroundColor).toBe(colors.statusWarningTint);
  });

  it('renders exactly one badge, never two, when both restricted and non-restricted entries matched', () => {
    render(<AllergenBadge matches={[NON_RESTRICTED_MATCH_A, RESTRICTED_MATCH_LYRAL]} />);
    expect(screen.getAllByTestId('allergen-badge')).toHaveLength(1);
  });
});

describe('Story 2 AC2 — accessibilityLabel distinguishes the restricted case', () => {
  it('uses a different accessibilityLabel for a restricted match than for a non-restricted match', () => {
    const { unmount } = render(<AllergenBadge matches={[NON_RESTRICTED_MATCH_A]} />);
    const nonRestrictedLabel = screen.getByTestId('allergen-badge').props.accessibilityLabel;
    unmount();

    render(<AllergenBadge matches={[RESTRICTED_MATCH_LILIAL]} />);
    const restrictedLabel = screen.getByTestId('allergen-badge').props.accessibilityLabel;

    expect(nonRestrictedLabel).toBeTruthy();
    expect(restrictedLabel).toBeTruthy();
    expect(restrictedLabel).not.toBe(nonRestrictedLabel);
  });
});
