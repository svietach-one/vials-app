/**
 * Component tests — WishlistEntryCard (FE-7).
 * Spec: docs/specs/explore-composition.md §4 Story 3 (AC2-3)
 * Tech design: docs/tech-design/explore-composition.md §3 FE-7
 * Source brief: docs/tasks/00-explore-composition-spec.md §4.3
 *
 * `src/components/product/WishlistEntryCard.tsx` does not exist yet — this
 * file is EXPECTED to fail until FE-7 lands.
 *
 * RESOLVED: the source brief and initial spec/tech design draft gave the
 * promote action's label verbatim as "Поставить на полку" (Russian), which
 * conflicted with CLAUDE.md's hard constraint "English only — all UI
 * text... (Phase 1)". Flagged by qa-lead rather than silently guessed; user
 * decided the English label is "Move to Shelf" (over "Put on Shelf", to
 * distinguish it from the result-screen's "Put on My Shelf" action). Spec
 * and tech design have been corrected accordingly.
 *
 * Props shape below (`entry`, `onCardPress`, `onPromote`, `onDelete`) is a
 * qa-lead judgment call mirroring the sibling `WishlistProductCardProps`
 * (`product`, `onCardPress`, `onPutOnShelf`, `onRemove`) — the tech design
 * says "sibling to, not shared with" but doesn't give an exact prop list.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@/components/ui/Icon', () => ({ Icon: () => null }));

// Guardrail: WishlistEntryCard must not reuse DeleteProductModal — see spec
// §4.3 / source brief §4.3. If the component ever imported it, this mock
// would render the modal's own "Remove product?" copy, which the assertions
// below explicitly check never appears.
jest.mock('@/components/product/DeleteProductModal', () => {
  const { View, Text } = require('react-native');
  return {
    DeleteProductModal: ({ product }: any) =>
      product ? (
        <View testID="delete-product-modal">
          <Text>Remove product?</Text>
        </View>
      ) : null,
  };
});

import { WishlistEntryCard } from '@/components/product/WishlistEntryCard';
import { makeWishlistEntry } from './fixtures';

function renderCard(overrides: Partial<Parameters<typeof makeWishlistEntry>[0]> = {}) {
  const onCardPress = jest.fn();
  const onPromote = jest.fn();
  const onDelete = jest.fn();
  const entry = makeWishlistEntry(overrides);
  render(
    <WishlistEntryCard
      entry={entry as never}
      onCardPress={onCardPress}
      onPromote={onPromote}
      onDelete={onDelete}
    />,
  );
  return { entry, onCardPress, onPromote, onDelete };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('renders the entry identity', () => {
  it('shows the brand and name entered when the entry was saved', () => {
    renderCard({ brand: 'Some Brand', name: 'Some Serum' });
    expect(screen.getByText('Some Brand')).toBeTruthy();
    expect(screen.getByText('Some Serum')).toBeTruthy();
  });
});

describe('Story 3 AC3: Delete has no confirmation modal and does not reuse DeleteProductModal', () => {
  it('calls onDelete immediately on a single press, with no modal ever appearing', () => {
    const { onDelete, entry } = renderCard();

    fireEvent.press(screen.getByText('Delete'));

    expect(onDelete).toHaveBeenCalledWith(entry);
    expect(screen.queryByTestId('delete-product-modal')).toBeNull();
    expect(screen.queryByText('Remove product?')).toBeNull();
  });
});

describe('Story 3 AC2 / Story 5 AC1: "Move to Shelf" opens the shared completion form', () => {
  it('calls onPromote with the full entry (brand, name, category, parsed ingredients) so the form can pre-fill', () => {
    const { onPromote, entry } = renderCard();

    fireEvent.press(screen.getByText('Move to Shelf'));

    expect(onPromote).toHaveBeenCalledWith(entry);
  });
});
