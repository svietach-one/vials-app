/**
 * Integration tests — ProductShelfCard hidden-state rendering
 * (hide-vial-bottomshield / tech-design FE-4)
 *
 * Spec: docs/specs/hide-vial-bottomshield.md
 * Tech design: docs/tech-design/hide-vial-bottomshield.md
 *
 * IMPORTANT — file-target drift: tech-design FE-4 points at
 * `CatalogScreen.renderItem` / `cardContent`, which predates the later
 * product-shelf-card refactor. Catalog cards are now rendered exclusively by
 * `ProductShelfCard` (src/components/product/ProductShelfCard.tsx), so these
 * tests target that component directly — it is the real, current rendering
 * surface for FE-4's acceptance criteria. Tech-lead should update FE-4's file
 * pointer before engineer starts.
 *
 * Required implementation contract (net-new, not yet present in ProductShelfCard):
 *   - testID="shelf-card-content" on the wrapper View containing name / brand /
 *     badges / schedule-or-hidden row. That wrapper must get style opacity: 0.4
 *     when product.isHidden is true, and normal (non-0.4) opacity otherwise.
 *   - An eye-off Feather icon rendered inside that content wrapper when
 *     product.isHidden is true (asserted here via the mocked Feather's
 *     testID="feather-icon-eye-off").
 *   - The overflow ("more actions") IconButton must stay outside the dimmed
 *     wrapper, at all times enabled and pressable, regardless of isHidden.
 *
 * AC-P1  Hidden product (isHidden: true) -> content wrapper has opacity 0.4
 * AC-P2  Visible product (isHidden: false) -> content wrapper does NOT have opacity 0.4
 * AC-P3  Legacy product (isHidden: undefined) -> treated as visible, no dimming
 * AC-P4  Hidden product -> eye-off Feather icon renders inside the content area
 * AC-P5  Visible product -> no eye-off icon renders
 * AC-P6  Hidden product -> overflow ("more actions") button remains enabled
 * AC-P7  Hidden product -> pressing the overflow button still opens the action sheet
 * AC-P8  Hidden product -> pressing the card body (outside overflow) still calls onCardPress
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ProductShelfCard } from '@/components/product/ProductShelfCard';
import { makeProduct, makeDefaultShelfCardProps } from '../product-shelf-card/fixtures';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/constants/labels', () => ({
  PRODUCT_TYPE_LABELS: { cleanser: 'Cleanser', serum: 'Serum' },
  ACTIVE_INGREDIENT_LABELS: {},
}));

jest.mock('@/utils/routineLabel', () => ({
  formatScheduleDays: jest.fn(() => 'Every day'),
  deriveProductSchedule: jest.fn(),
  formatRoutineLabel: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderCard(overrides: Partial<ReturnType<typeof makeDefaultShelfCardProps>> = {}) {
  const props = { ...makeDefaultShelfCardProps(), ...overrides };
  render(<ProductShelfCard {...props} />);
  return props;
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean).map(flattenStyle));
  }
  return (style as Record<string, unknown>) ?? {};
}

// ── AC-P1 / AC-P2 / AC-P3 — content opacity ───────────────────────────────────

describe('AC-P1: hidden product dims the card content to opacity 0.4', () => {
  it('should apply opacity 0.4 to the content wrapper when isHidden is true', () => {
    renderCard({ product: makeProduct({ isHidden: true }) });
    const content = screen.getByTestId('shelf-card-content');
    expect(flattenStyle(content.props.style).opacity).toBe(0.4);
  });
});

describe('AC-P2: visible product does not dim the card content', () => {
  it('should NOT apply opacity 0.4 to the content wrapper when isHidden is false', () => {
    renderCard({ product: makeProduct({ isHidden: false }) });
    const content = screen.getByTestId('shelf-card-content');
    expect(flattenStyle(content.props.style).opacity).not.toBe(0.4);
  });
});

describe('AC-P3: legacy product (isHidden undefined) is treated as visible', () => {
  it('should NOT dim the content wrapper when isHidden is absent', () => {
    const legacyProduct = makeProduct();
    delete (legacyProduct as { isHidden?: boolean }).isHidden;
    renderCard({ product: legacyProduct });
    const content = screen.getByTestId('shelf-card-content');
    expect(flattenStyle(content.props.style).opacity).not.toBe(0.4);
  });
});

// ── AC-P4 / AC-P5 — eye-off badge ─────────────────────────────────────────────

describe('AC-P4: eye-off icon renders inside the content area for hidden products', () => {
  it('should render the eye-off Feather icon when isHidden is true', () => {
    renderCard({ product: makeProduct({ isHidden: true }) });
    expect(screen.getByTestId('feather-icon-eye-off')).toBeTruthy();
  });
});

describe('AC-P5: no eye-off icon for visible products', () => {
  it('should NOT render the eye-off Feather icon when isHidden is false', () => {
    renderCard({ product: makeProduct({ isHidden: false }) });
    expect(screen.queryByTestId('feather-icon-eye-off')).toBeNull();
  });
});

// ── AC-P6 / AC-P7 — overflow button always interactive ────────────────────────

describe('AC-P6: overflow button stays enabled on a hidden card', () => {
  it('should not mark the "more actions" button disabled when the card is hidden', () => {
    renderCard({ product: makeProduct({ isHidden: true }) });
    const overflow = screen.getByLabelText(/more actions/i);
    expect(overflow.props.disabled).not.toBe(true);
  });
});

describe('AC-P7: overflow button opens the action sheet on a hidden card', () => {
  it('should open ProductActionSheet when the overflow button is tapped on a hidden product', () => {
    renderCard({ product: makeProduct({ isHidden: true }) });
    fireEvent.press(screen.getByLabelText(/more actions/i));
    expect(screen.getByText('Edit Product')).toBeTruthy();
  });
});

// ── AC-P8 — card body remains tappable ────────────────────────────────────────

describe('AC-P8: card body remains tappable and navigates on a hidden card', () => {
  it('should call onCardPress when the hidden card body is tapped', () => {
    const props = renderCard({
      product: makeProduct({ isHidden: true, name: 'Ceramide Repair Serum' }),
    });
    fireEvent.press(screen.getByRole('button', { name: /ceramide repair serum.*tap to view/i }));
    expect(props.onCardPress).toHaveBeenCalledTimes(1);
  });
});
