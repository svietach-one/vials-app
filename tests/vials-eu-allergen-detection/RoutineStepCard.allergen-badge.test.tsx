/**
 * Component/integration test — AllergenBadge wired into RoutineStepCard (FE-6)
 * Spec: docs/specs/vials-eu-allergen-detection.md Story 1 + Story 2 acceptance criteria.
 * Tech design: docs/tech-design/vials-eu-allergen-detection.md FE-6.
 *
 * Scope per the qa-lead task brief: confirm wiring only (one Cobalt case, one Amber
 * case, one zero-match case, plus the "after the zap badge" position), not the full
 * color matrix — that's already exhaustively covered for the shared AllergenBadge
 * component in AllergenBadge.test.tsx and for ProductShelfCard's wiring in
 * ProductShelfCard.allergen-badge.test.tsx.
 *
 * `src/utils/allergenDetector.ts` (FE-3) and `src/components/ui/AllergenBadge.tsx` (FE-4)
 * do not exist yet, so this whole suite is EXPECTED TO FAIL TO RESOLVE until FE-3 lands
 * (see ProductShelfCard.allergen-badge.test.tsx's header for the moduleNameMapper-related
 * reason a not-yet-existing `@/` module can't even be mocked cleanly), then EXPECTED TO
 * FAIL ASSERTIONS until FE-4/FE-6 actually wire the badge in.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { RoutineStepCard } from '@/components/routine/RoutineStepCard';
import { colors } from '@/constants/tokens';

import { collectTestIdOrder, makeProduct, NON_RESTRICTED_MATCH_A, RESTRICTED_MATCH_LILIAL } from './fixtures';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/constants/labels', () => ({
  PRODUCT_TYPE_LABELS: { lotion: 'Lotion', serum: 'Serum' },
  ACTIVE_INGREDIENT_LABELS: { niacinamide: 'Niacinamide' },
  getProductTypeBadgeStatus: jest.fn(() => 'Default'),
}));

jest.mock('@/utils/allergenDetector', () => ({
  getProductAllergenMatches: jest.fn((product: any) => product.detectedAllergens ?? []),
  hasRestrictedAllergenMatch: jest.fn((matches: any[]) => matches.some((m: any) => m.restricted)),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenStyle(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

// ── One Cobalt case ───────────────────────────────────────────────────────────

describe('Wiring — one Cobalt case', () => {
  it('renders the allergen badge in Cobalt when the routine-step product has a non-restricted match', () => {
    const product = makeProduct({ detectedAllergens: [NON_RESTRICTED_MATCH_A] });
    render(<RoutineStepCard product={product} />);

    const badge = flattenStyle(screen.getByTestId('allergen-badge').props.style);
    expect(badge.backgroundColor).toBe(colors.statusInfoTint);
  });
});

// ── One Amber case ────────────────────────────────────────────────────────────

describe('Wiring — one Amber case', () => {
  it('renders the allergen badge in Amber when the routine-step product has a restricted match', () => {
    const product = makeProduct({ detectedAllergens: [RESTRICTED_MATCH_LILIAL] });
    render(<RoutineStepCard product={product} />);

    const badge = flattenStyle(screen.getByTestId('allergen-badge').props.style);
    expect(badge.backgroundColor).toBe(colors.statusWarningTint);
  });
});

// ── One zero-match case ───────────────────────────────────────────────────────

describe('Wiring — one zero-match case', () => {
  it('renders no allergen badge when the routine-step product has zero allergen matches', () => {
    const product = makeProduct({ detectedAllergens: [] });
    render(<RoutineStepCard product={product} />);
    expect(screen.queryByTestId('allergen-badge')).toBeNull();
  });
});

// ── Position — after the existing zap actives badge ──────────────────────────

describe('Wiring — positioned after the existing zap actives badge', () => {
  it('renders the zap actives badge before the allergen badge in the badges row', () => {
    const product = makeProduct({
      activeTags: ['niacinamide'],
      detectedAllergens: [NON_RESTRICTED_MATCH_A],
    });
    const { toJSON } = render(<RoutineStepCard product={product} />);

    const order = collectTestIdOrder(
      toJSON() as any,
      new Set(['active-badge-niacinamide', 'allergen-badge']),
    );
    expect(order).toEqual(['active-badge-niacinamide', 'allergen-badge']);
  });
});
