/**
 * Component/integration tests — detected-active badge wiring (FE-4/FE-5).
 * Spec: docs/specs/inci-attribution-highlighting.md — Story 1 (entry point) + Story 3 (both ACs).
 * Tech design: docs/tech-design/inci-attribution-highlighting.md FE-4/FE-5.
 *
 * Anchor components (qa-lead decision — see fixtures.ts contract header and
 * progress/inci-attribution-highlighting.md 2026-07-06 log for the full gap
 * writeup on why these two, and not a component matching the tech design's
 * literal `grep -rn "detected"` locator, which returns no hits):
 *   1. ProductDetailScreen.tsx  — "Active Ingredients" Tag list (product-detail
 *      ingredient summary, spec §5).
 *   2. RoutineStepCard.tsx      — the single `activeBadge`, rendered on the
 *      same card as the conflict row (routine-surface badge, spec §5).
 *
 * AttributionTooltip and aliasOverrides.json are mocked at the module boundary
 * here — this file tests WIRING only (which props reach the tooltip / whether
 * the alias icon renders), not AttributionTooltip's own rendering (covered in
 * AttributionTooltip.test.tsx) or ingredientParser's matching logic (covered
 * by the engineer's src/utils/ingredientParser.test.ts, FE-6).
 *
 * Out of scope: Story 2 ("View on label"), any bounding-box/image assertions.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product } from '@/types';

import {
  INCIDENT_PRODUCT,
  CANONICAL_TERM_PRODUCT,
  MULTI_MATCH_PRODUCT,
  NO_INCI_TEXT_PRODUCT,
  makeProduct,
} from './fixtures';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

jest.mock('@/constants/labels', () => ({
  PRODUCT_TYPE_LABELS: { ampoule: 'Ampoule', serum: 'Serum', cleanser: 'Cleanser' },
  ACTIVE_INGREDIENT_LABELS: { bha: 'BHA', niacinamide: 'Niacinamide' },
}));

// aliasOverrides.json (FE-2) does not exist on disk yet. This mirrors just
// the two confirmed aliases from the spec's incident writeup; the real
// seeded file may contain more entries, which is irrelevant to wiring
// correctness tested here.
//
// NOTE 1: jest.mock factories may not reference this file's own top-level
// imports (babel-plugin-jest-hoist's "out-of-scope variable" restriction) —
// the factory below re-requires ./fixtures lazily instead.
//
// NOTE 2: no `{ virtual: true }` here — verified this project's jest config
// (moduleNameMapper `@/*` + react-native's custom resolver, see the "jest"
// block in package.json) cannot resolve a virtual mock through the `@/`
// alias for a file that doesn't exist on disk (fails identically with or
// without the virtual flag). This means this test suite, like
// AttributionTooltip.test.tsx, is EXPECTED to fail to resolve until FE-2
// creates the real src/constants/rulesets/aliasOverrides.json file — at
// which point this plain jest.mock() transparently overrides its contents
// with the fixture below, no test change needed.
jest.mock(
  '@/constants/rulesets/aliasOverrides.json',
  () => require('./fixtures').ALIAS_OVERRIDES_FIXTURE,
);

// parseActiveIngredientDetails (FE-1) does not carry `matches` yet — mocked
// here so badge-wiring correctness doesn't depend on FE-1's regex internals
// (that's FE-6's job). Keyed by the exact fullIngredientText of each fixture.
jest.mock('@/utils/ingredientParser', () => {
  const fx = require('./fixtures');
  return {
    parseActiveIngredientDetails: jest.fn((text: string | null) => {
      if (text === fx.INCIDENT_PRODUCT.fullIngredientText) {
        return [
          { key: 'bha', potency: 'medium', matches: [fx.BHA_BETAINE_SALICYLATE_MATCH] },
          { key: 'niacinamide', potency: 'medium', matches: [fx.NIACINAMIDE_MATCH] },
        ];
      }
      if (text === fx.CANONICAL_TERM_PRODUCT.fullIngredientText) {
        return [{ key: 'bha', potency: 'high', matches: [fx.BHA_SALICYLIC_ACID_MATCH] }];
      }
      if (text === fx.MULTI_MATCH_PRODUCT.fullIngredientText) {
        return [
          {
            key: 'bha',
            potency: 'high',
            matches: [fx.BHA_SALICYLIC_ACID_MATCH, fx.BHA_WILLOW_BARK_MATCH],
          },
        ];
      }
      return [];
    }),
    parseActiveIngredientsFromInci: jest.fn(() => []),
    normalizeActiveKey: jest.fn((key: string) => key),
    getProductActiveKeys: jest.fn(() => []),
  };
});

// Stub AttributionTooltip so these tests assert wiring (props received), not
// its own rendering (covered separately in AttributionTooltip.test.tsx).
jest.mock('@/components/routine/AttributionTooltip', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    AttributionTooltip: (props: any) =>
      props.visible ? (
        <View testID="attribution-tooltip-mock">
          <Text testID="attribution-tooltip-mock-displayName">{props.displayName}</Text>
          <Text testID="attribution-tooltip-mock-matches">
            {JSON.stringify(props.matches)}
          </Text>
          <Pressable testID="attribution-tooltip-mock-close" onPress={props.onClose} />
        </View>
      ) : null,
  };
});

jest.mock('@/utils/routineLabel', () => ({
  formatScheduleDays: jest.fn(() => 'Mon • Wed • Sat'),
  deriveProductSchedule: jest.fn(() => null),
  formatRoutineLabel: jest.fn(() => null),
}));

jest.mock('@/components/product/DeleteProductModal', () => ({ DeleteProductModal: () => null }));
jest.mock('@/components/product/ProductActionSheet', () => ({ ProductActionSheet: () => null }));
jest.mock('@/components/routine/RemoveRoutineActionSheet', () => ({
  RemoveRoutineActionSheet: () => null,
}));
jest.mock('@/components/routine/RoutineSchedulerSheet', () => ({
  RoutineSchedulerSheet: () => null,
}));
jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) => selector({ routines: [] })),
}));

let mockProducts: Product[] = [];
const mockUpdateProduct = jest.fn();
jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) =>
    selector({ products: mockProducts, updateProduct: mockUpdateProduct }),
  ),
}));

import ProductDetailScreen from '@/screens/ProductDetailScreen';
import { RoutineStepCard } from '@/components/routine/RoutineStepCard';

function renderProductDetail(productId: string) {
  return render(
    <ProductDetailScreen
      navigation={{ navigate: jest.fn(), goBack: jest.fn() } as any}
      route={{ params: { productId } } as any}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProducts = [];
});

// ── Story 1 entry point — ProductDetailScreen ingredient summary ─────────────

describe('ProductDetailScreen — Active Ingredients badges open AttributionTooltip', () => {
  it('opens the tooltip with the matched substrings for that key on tap', () => {
    mockProducts = [INCIDENT_PRODUCT];
    renderProductDetail(INCIDENT_PRODUCT.id);

    fireEvent.press(screen.getByTestId('active-badge-bha'));

    expect(screen.getByTestId('attribution-tooltip-mock')).toBeTruthy();
    expect(screen.getByTestId('attribution-tooltip-mock-matches').props.children).toEqual(
      expect.stringContaining('Betaine Salicylate'),
    );
  });

  it('closes the tooltip when the tooltip requests onClose', () => {
    mockProducts = [INCIDENT_PRODUCT];
    renderProductDetail(INCIDENT_PRODUCT.id);

    fireEvent.press(screen.getByTestId('active-badge-bha'));
    expect(screen.getByTestId('attribution-tooltip-mock')).toBeTruthy();

    fireEvent.press(screen.getByTestId('attribution-tooltip-mock-close'));
    expect(screen.queryByTestId('attribution-tooltip-mock')).toBeNull();
  });

  it('exposes each active-ingredient badge as an accessible button', () => {
    mockProducts = [INCIDENT_PRODUCT];
    renderProductDetail(INCIDENT_PRODUCT.id);

    expect(screen.getByTestId('active-badge-bha').props.accessibilityRole).toBe('button');
    expect(screen.getByTestId('active-badge-niacinamide').props.accessibilityRole).toBe(
      'button',
    );
  });

  it('does not crash and still opens a tooltip with no matches when the product has no fullIngredientText', () => {
    mockProducts = [NO_INCI_TEXT_PRODUCT];
    renderProductDetail(NO_INCI_TEXT_PRODUCT.id);

    fireEvent.press(screen.getByTestId('active-badge-bha'));

    expect(screen.getByTestId('attribution-tooltip-mock')).toBeTruthy();
  });
});

// ── Story 3 — alias indicator on the badge itself ─────────────────────────────

describe('Story 3 AC1 — badge carries an alias indicator when a matcher has an override', () => {
  it('shows the alias icon on the bha badge when the matched substring is the incident alias', () => {
    mockProducts = [INCIDENT_PRODUCT];
    renderProductDetail(INCIDENT_PRODUCT.id);

    expect(screen.getByTestId('active-badge-alias-icon-bha')).toBeTruthy();
    expect(screen.getByLabelText('Detected via regional ingredient name')).toBeTruthy();
  });

  it('shows the alias icon when only one of several matchers for the class has an override', () => {
    mockProducts = [MULTI_MATCH_PRODUCT];
    renderProductDetail(MULTI_MATCH_PRODUCT.id);

    expect(screen.getByTestId('active-badge-alias-icon-bha')).toBeTruthy();
  });
});

describe('Story 3 AC2 — no alias indicator when no matcher has an override', () => {
  it('does not show the alias icon on the bha badge when matched via the canonical term', () => {
    mockProducts = [CANONICAL_TERM_PRODUCT];
    renderProductDetail(CANONICAL_TERM_PRODUCT.id);

    expect(screen.queryByTestId('active-badge-alias-icon-bha')).toBeNull();
  });

  it('does not show the alias icon on a badge for a class with no registered override at all', () => {
    mockProducts = [INCIDENT_PRODUCT];
    renderProductDetail(INCIDENT_PRODUCT.id);

    expect(screen.queryByTestId('active-badge-alias-icon-niacinamide')).toBeNull();
  });
});

// ── RoutineStepCard — the routine-surface badge ───────────────────────────────

describe('RoutineStepCard — active badge opens AttributionTooltip', () => {
  it('opens the tooltip with the matched substrings when the badge is tapped', () => {
    render(<RoutineStepCard product={INCIDENT_PRODUCT} />);

    fireEvent.press(screen.getByTestId('active-badge-bha'));

    expect(screen.getByTestId('attribution-tooltip-mock')).toBeTruthy();
    expect(screen.getByTestId('attribution-tooltip-mock-matches').props.children).toEqual(
      expect.stringContaining('Betaine Salicylate'),
    );
  });

  it('shows the alias icon when the routine step product matched via a regional alias', () => {
    render(<RoutineStepCard product={INCIDENT_PRODUCT} />);
    expect(screen.getByTestId('active-badge-alias-icon-bha')).toBeTruthy();
  });

  it('does not show the alias icon when the routine step product matched via the canonical term', () => {
    render(<RoutineStepCard product={CANONICAL_TERM_PRODUCT} />);
    expect(screen.queryByTestId('active-badge-alias-icon-bha')).toBeNull();
  });

  it('does not render an active badge (or crash) for a product with no active ingredients', () => {
    const noActives = makeProduct({ id: 'no-actives', activeTags: [], activeIngredients: [] });
    render(<RoutineStepCard product={noActives} />);
    expect(screen.queryByTestId(/^active-badge-/)).toBeNull();
  });

  it('still renders the existing conflict row unaffected by the badge-wiring change', () => {
    render(
      <RoutineStepCard product={INCIDENT_PRODUCT} conflictingProductName="Retinol Serum" />,
    );
    expect(screen.getByText(/Conflicts with Retinol Serum/)).toBeTruthy();
  });
});
