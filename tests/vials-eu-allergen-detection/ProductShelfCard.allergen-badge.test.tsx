/**
 * Component/integration test — AllergenBadge wired into ProductShelfCard (FE-5)
 * Spec: docs/specs/vials-eu-allergen-detection.md Story 1 + Story 2 acceptance criteria.
 * Tech design: docs/tech-design/vials-eu-allergen-detection.md FE-5.
 *
 * `src/utils/allergenDetector.ts` (FE-3) and `src/components/ui/AllergenBadge.tsx` (FE-4)
 * do not exist yet. Mocking a not-yet-existing module via the `@/` alias fails to resolve
 * regardless of the mock factory (moduleNameMapper interaction — same documented behavior
 * as tests/inci-attribution-highlighting/DetectedActiveBadgeWiring.test.tsx's
 * `aliasOverrides.json` mock), so this whole suite is EXPECTED TO FAIL TO RESOLVE until
 * FE-3 lands, then EXPECTED TO FAIL ASSERTIONS until FE-4/FE-5 actually wire the badge in.
 *
 * `getProductAllergenMatches` is mocked as a passthrough of `product.detectedAllergens` so
 * this suite tests wiring + the badge's own color precedence together, independent of the
 * actual INCI-scanning logic (FE-9, engineer's unit-test scope — not re-tested here).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ProductShelfCard } from '@/components/product/ProductShelfCard';
import { colors } from '@/constants/tokens';

import {
  makeDefaultShelfCardProps,
  makeProduct,
  NON_RESTRICTED_MATCH_A,
  NON_RESTRICTED_MATCH_B,
  RESTRICTED_MATCH_LILIAL,
} from './fixtures';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/constants/labels', () => ({
  PRODUCT_TYPE_LABELS: { lotion: 'Lotion', cleanser: 'Cleanser', serum: 'Serum' },
  ACTIVE_INGREDIENT_LABELS: {},
  getProductTypeBadgeStatus: jest.fn(() => 'Default'),
}));

jest.mock('@/utils/allergenDetector', () => ({
  getProductAllergenMatches: jest.fn((product: any) => product.detectedAllergens ?? []),
  hasRestrictedAllergenMatch: jest.fn((matches: any[]) => matches.some((m: any) => m.restricted)),
}));

jest.mock('@/utils/routineLabel', () => ({
  formatScheduleDays: jest.fn(() => 'Every day'),
  deriveProductSchedule: jest.fn(),
  formatRoutineLabel: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenStyle(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

function renderCard(overrides: Partial<ReturnType<typeof makeDefaultShelfCardProps>> = {}) {
  const props = { ...makeDefaultShelfCardProps(), ...overrides };
  render(<ProductShelfCard {...props} />);
  return props;
}

// ── Story 1 AC1 — Cobalt badge ────────────────────────────────────────────────

describe('Story 1 AC1 — Cobalt badge for >=1 non-restricted allergen match', () => {
  it('renders the allergen badge in Cobalt when the product matches only non-restricted entries', () => {
    const product = makeProduct({ detectedAllergens: [NON_RESTRICTED_MATCH_A] });
    renderCard({ product });

    const badge = flattenStyle(screen.getByTestId('allergen-badge').props.style);
    expect(badge.backgroundColor).toBe(colors.statusInfoTint);
  });
});

// ── Story 1 AC2/AC3 — no badge ────────────────────────────────────────────────

describe('Story 1 AC2/AC3 — no badge at all when zero matches or fullIngredientText is null', () => {
  it('renders no allergen badge when the product has zero allergen matches', () => {
    const product = makeProduct({ detectedAllergens: [] });
    renderCard({ product });
    expect(screen.queryByTestId('allergen-badge')).toBeNull();
  });

  it('renders no allergen badge when fullIngredientText is null', () => {
    const product = makeProduct({ fullIngredientText: null, detectedAllergens: [] });
    renderCard({ product });
    expect(screen.queryByTestId('allergen-badge')).toBeNull();
  });
});

// ── Story 2 AC1 — Amber precedence ────────────────────────────────────────────

describe('Story 2 AC1 — Amber badge takes precedence for a restricted match', () => {
  it('renders Amber when the product matches only a restricted entry', () => {
    const product = makeProduct({ detectedAllergens: [RESTRICTED_MATCH_LILIAL] });
    renderCard({ product });

    const badge = flattenStyle(screen.getByTestId('allergen-badge').props.style);
    expect(badge.backgroundColor).toBe(colors.statusWarningTint);
  });

  it('renders Amber (not Cobalt), and only one badge, when non-restricted entries also matched the same product', () => {
    const product = makeProduct({
      detectedAllergens: [NON_RESTRICTED_MATCH_A, RESTRICTED_MATCH_LILIAL, NON_RESTRICTED_MATCH_B],
    });
    renderCard({ product });

    expect(screen.getAllByTestId('allergen-badge')).toHaveLength(1);
    const badge = flattenStyle(screen.getByTestId('allergen-badge').props.style);
    expect(badge.backgroundColor).toBe(colors.statusWarningTint);
  });
});
