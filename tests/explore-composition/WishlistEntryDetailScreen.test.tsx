/**
 * Component tests — WishlistEntryDetailScreen (Story 9, FE-16..FE-23).
 * Spec: docs/specs/explore-composition.md §4 Story 9 (full AC list), §3
 *       Non-Goals (2026-08-27 additions: no inline brand/name/category
 *       editing, no page-level combined empty-state banner)
 * Tech design: docs/tech-design/explore-composition.md §1 (Story 9 diagram),
 *       §3 FE-16..FE-23, §4 (Story 9 Assumptions batch)
 *
 * `src/screens/catalog/WishlistEntryDetailScreen.tsx` does not exist yet —
 * every describe block below is EXPECTED to fail until FE-16..FE-23 land,
 * same qa-lead-before-engineer convention as every prior slice in this task.
 *
 * Reuse contract this file exercises but does NOT re-derive: the 5 insight
 * sections + disclaimer are the SAME already-shipped components
 * `ExploreCompositionResultScreen.tsx` uses (`detected-actives`,
 * `skin-type-caution`, `composition-comparison-matrix`, `routine-placement`,
 * `explore-result-disclaimer` testIDs — all already-accepted contracts from
 * the second slice, not new judgment calls here). This file does not
 * re-verify their internal computation logic (already covered by
 * `ExploreCompositionResultScreen.test.tsx`'s Story 6/7/8 blocks and by
 * engineer's own `shelfComparison.test.ts`/`skinTypeCaution.test.ts`) — it
 * only asserts that THIS screen renders the same sections, each
 * independently populated/empty, per spec Story 9 AC4.
 *
 * `CompositionInsightsSection`/`useCompositionInsights` are NOT tested
 * directly in a standalone file here — the tech design's own qa-lead task
 * list (docs/tech-design/explore-composition.md §3) only names this new
 * screen's test file plus the `CatalogScreen` onCardPress regression; it
 * does not call for a third, separate `CompositionInsightsSection.test.tsx`.
 * Exercising the shared section through both of its real callers (this file,
 * plus the untouched `ExploreCompositionResultScreen.test.tsx`) already
 * covers its rendered behavior without inventing an unscoped extra suite.
 * `useCompositionInsights` itself is a thin recomposition of already-tested
 * pure builders — engineer's co-located unit-test responsibility per
 * tech design §3 / `.claude/rules/testing.md`, same convention as
 * `resolveFromRawText`/`shelfComparison`/`skinTypeCaution`'s own internals in
 * every prior slice.
 *
 * New testID contracts invented HERE (component doesn't exist yet — judgment
 * calls, flagged for engineer/tech-lead to confirm or override, same
 * convention as this task's own `explore-result-disclaimer` /
 * `wishlist-entry-save-confirm`):
 *   - `wishlist-detail-brand`: the identity header's brand line, present only
 *     when `entry.brand` is set.
 *   - `wishlist-detail-category-badge`: the identity header's category badge,
 *     present only when `entry.category` is set.
 *   - `wishlist-notes-input`: the Notes card's `Textarea` — `Textarea` spreads
 *     unknown props onto its underlying `TextInput` (see
 *     `src/components/ui/forms/Textarea.tsx`), so a `testID` passed to it
 *     lands on the real `TextInput` and is queryable/settable exactly like
 *     any other RN `TextInput` in this suite.
 * `Card` stays mocked as a plain passthrough `View` (this file's/this task's
 * established convention) — so, per the same precedent already used for
 * `composition-comparison-matrix`/`routine-placement`/
 * `explore-result-disclaimer`, any wrapper `testID` this screen needs
 * (identity header, notes card) must sit on a plain `View`, not directly on
 * `<Card>`, or it will never reach the rendered tree under this mock.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@/components/ui/Icon', () => ({ Icon: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/ui/core/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ onPress, children, disabled, accessibilityLabel, testID }: any) => (
      <Pressable
        onPress={disabled ? undefined : onPress}
        accessibilityLabel={accessibilityLabel ?? String(children)}
        accessibilityState={{ disabled: !!disabled }}
        testID={testID}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/components/ui/core/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: any) => <View>{children}</View> };
});

jest.mock('@/components/ui/core/Tag', () => {
  const { Text } = require('react-native');
  return { Tag: ({ children }: any) => <Text>{children}</Text> };
});

jest.mock('@/components/ui/core/IconButton', () => {
  const { Pressable } = require('react-native');
  return {
    IconButton: ({ onPress, label }: any) => (
      <Pressable onPress={onPress} accessibilityLabel={label} />
    ),
  };
});

// Guardrail: WishlistEntryDetailScreen must never reuse DeleteProductModal
// for its own Delete action — same rule Story 3 AC3 established for
// WishlistEntryCard's own Delete button. If the screen ever imported it,
// this mock would render "Remove product?" copy, which the assertions below
// explicitly check never appears.
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

// FE-3 boundary — same convention as ExploreCompositionResultScreen.test.tsx:
// only resolveFromRawText is mocked, join.ts/capabilities.ts/shelfComparison.ts/
// skinTypeCaution.ts/routinePosition.ts all run for REAL (already shipped,
// PR_REVIEW), so this stays an integration test of the real, reused pipeline
// via useCompositionInsights — not a re-derivation of its own logic.
const mockResolveFromRawText = jest.fn();
jest.mock('@/utils/productProfile/resolve', () => ({
  ...jest.requireActual('@/utils/productProfile/resolve'),
  resolveFromRawText: (...args: unknown[]) => mockResolveFromRawText(...args),
}));

let mockProducts: any[] = [];
jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

let mockProfile: { skinType: string | null } = { skinType: null };
jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: mockProfile })),
}));

const mockRemoveEntry = jest.fn();
const mockUpdateEntry = jest.fn();
let mockEntries: any[] = [];
jest.mock('@/store/wishlistStore', () => ({
  useWishlistStore: jest.fn((selector: any) =>
    selector({
      entries: mockEntries,
      removeEntry: mockRemoveEntry,
      updateEntry: mockUpdateEntry,
      addEntry: jest.fn(),
    }),
  ),
}));

import WishlistEntryDetailScreen from '@/screens/catalog/WishlistEntryDetailScreen';
import { PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { makeNavigation, makeProduct, makeResolvedIngredients, makeWishlistEntry } from './fixtures';

const RAW_TEXT = 'Aqua, Niacinamide, Hyaluronic Acid';

function renderScreen(wishlistEntryId = 'entry-1') {
  const navigation = makeNavigation();
  render(
    <WishlistEntryDetailScreen
      navigation={navigation}
      route={{ params: { wishlistEntryId } } as any}
    />,
  );
  return navigation as { navigate: jest.Mock; goBack: jest.Mock };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProducts = [];
  mockProfile = { skinType: null };
  mockEntries = [
    makeWishlistEntry({
      id: 'entry-1',
      brand: 'Some Brand',
      name: 'Some Serum',
      category: 'serum',
      rawIngredientsText: RAW_TEXT,
      parsedIngredientIds: ['niacinamide', 'hyaluronic_acid'],
      notes: null,
    }),
  ];
  mockResolveFromRawText.mockReturnValue(
    makeResolvedIngredients({
      resolvedActiveKeys: ['niacinamide', 'hyaluronic_acid'],
      unresolvedIngredientTokens: [],
    }),
  );
});

// ── Not-found guard (spec Story 9 AC7) ────────────────────────────────────────

describe('Not-found guard: a stale or deleted wishlistEntryId never crashes, never fabricates content', () => {
  it('shows a "Composition not found" state with a Go Back action, mirroring ProductDetailScreen\'s own not-found block', () => {
    mockEntries = [];
    renderScreen('missing-id');

    expect(screen.getByText('Composition not found')).toBeTruthy();
    expect(screen.getByText('Go Back')).toBeTruthy();
  });

  it('calls navigation.goBack when Go Back is pressed in the not-found state', () => {
    mockEntries = [];
    const navigation = renderScreen('missing-id');

    fireEvent.press(screen.getByText('Go Back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('renders none of the insight sections, the notes card, or the footer actions when the entry is missing', () => {
    mockEntries = [];
    renderScreen('missing-id');

    expect(screen.queryByTestId('detected-actives')).toBeNull();
    expect(screen.queryByTestId('wishlist-notes-input')).toBeNull();
    expect(screen.queryByText('Move to Shelf')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });
});

// ── Identity header (spec Story 9 AC2-3) ──────────────────────────────────────

describe('Identity header: text-only, brand/name/category-badge — no photo', () => {
  it('shows the brand above the name when brand is set', () => {
    renderScreen();

    expect(within(screen.getByTestId('wishlist-detail-brand')).getByText('Some Brand')).toBeTruthy();
    expect(screen.getAllByText('Some Serum').length).toBeGreaterThan(0);
  });

  it('falls back to "Untitled composition" — the same fallback WishlistEntryCard already uses — when name is null', () => {
    mockEntries = [makeWishlistEntry({ id: 'entry-1', name: null, brand: null, category: null })];
    renderScreen();

    expect(screen.getAllByText('Untitled composition').length).toBeGreaterThan(0);
  });

  it('renders no brand line at all when brand is null', () => {
    mockEntries = [makeWishlistEntry({ id: 'entry-1', brand: null })];
    renderScreen();

    expect(screen.queryByTestId('wishlist-detail-brand')).toBeNull();
  });

  it('shows a category badge with the same PRODUCT_TYPE_LABELS text used elsewhere when category is set', () => {
    renderScreen(); // category: 'serum'

    expect(
      within(screen.getByTestId('wishlist-detail-category-badge')).getByText(PRODUCT_TYPE_LABELS.serum),
    ).toBeTruthy();
  });

  it('renders no category badge, placeholder, or "unknown category" text when category is null', () => {
    mockEntries = [makeWishlistEntry({ id: 'entry-1', category: null })];
    renderScreen();

    expect(screen.queryByTestId('wishlist-detail-category-badge')).toBeNull();
    expect(screen.queryByText(/unknown category/i)).toBeNull();
  });

  it('never renders a photo/thumbnail placeholder — WishlistEntry has no image field', () => {
    renderScreen();

    expect(screen.queryByTestId('product-thumbnail')).toBeNull();
    expect(screen.queryByLabelText(/photo/i)).toBeNull();
  });
});

// ── Reused insight sections (spec Story 9 AC4-6) ──────────────────────────────

describe('Reuses the same 5 insight sections + disclaimer already on ExploreCompositionResultScreen, each independently populated/empty', () => {
  it('renders functional-profile tags for the entry\'s parsed composition', () => {
    renderScreen();

    expect(screen.getByText('Soothing')).toBeTruthy();
    expect(screen.getByText('Hydration')).toBeTruthy();
  });

  it('shows the Functional profile\'s own empty state when no capability tags resolve', () => {
    mockResolveFromRawText.mockReturnValue(
      makeResolvedIngredients({ resolvedActiveKeys: [], unresolvedIngredientTokens: [] }),
    );
    renderScreen();

    expect(screen.getByText(/no known functional tags detected/i)).toBeTruthy();
  });

  it('shows the Detected actives list (same testID as the result screen) when actives resolve', () => {
    renderScreen();

    const section = screen.getByTestId('detected-actives');
    expect(within(section).getByText(/niacinamide/i)).toBeTruthy();
    expect(within(section).getByText(/hyaluronic acid/i)).toBeTruthy();
  });

  it('states plainly, never silently, when no active ingredients are detected', () => {
    mockResolveFromRawText.mockReturnValue(
      makeResolvedIngredients({ resolvedActiveKeys: [], unresolvedIngredientTokens: ['Aqua'] }),
    );
    renderScreen();

    expect(within(screen.getByTestId('detected-actives')).getByText(/no.*active ingredients.*detected/i)).toBeTruthy();
  });

  it('renders the skin-type caution when its trigger fires and profile.skinType is set', () => {
    mockProfile = { skinType: 'oily' };
    mockResolveFromRawText.mockReturnValue(
      makeResolvedIngredients({ resolvedActiveKeys: ['aha'], unresolvedIngredientTokens: [] }),
    );
    renderScreen();

    expect(screen.getByTestId('skin-type-caution')).toBeTruthy();
  });

  it('renders no caution element at all when the trigger does not fire (default fixture: niacinamide + hyaluronic_acid)', () => {
    renderScreen();

    expect(screen.queryByTestId('skin-type-caution')).toBeNull();
  });

  it('renders the comparison matrix when category is set and a same-category Shelf item exists', () => {
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];
    renderScreen();

    expect(screen.getByTestId('composition-comparison-matrix')).toBeTruthy();
  });

  it('shows the zero-items message, never fabricated numbers, when no same-category Shelf item exists', () => {
    mockProducts = [];
    renderScreen();

    expect(screen.getByTestId('composition-comparison-matrix')).toBeTruthy();
    expect(screen.queryByTestId('matrix-row-category-signal')).toBeNull();
  });

  it('renders neither the comparison matrix nor routine placement when category is null — same gating rule as the result screen', () => {
    mockEntries = [makeWishlistEntry({ id: 'entry-1', category: null })];
    renderScreen();

    expect(screen.queryByTestId('composition-comparison-matrix')).toBeNull();
    expect(screen.queryByTestId('routine-placement')).toBeNull();
  });

  it('renders the routine-placement phase label when category is set', () => {
    renderScreen();

    expect(within(screen.getByTestId('routine-placement')).getByText(/treatment/i)).toBeTruthy();
  });

  it('always shows the same disclaimer footer already shown on the result screen', () => {
    renderScreen();

    expect(screen.getByTestId('explore-result-disclaimer')).toBeTruthy();
  });

  it('never shows a single combined "nothing to show yet" message standing in for all 5 sections (spec §3 Non-Goal)', () => {
    mockEntries = [makeWishlistEntry({ id: 'entry-1', category: null, rawIngredientsText: '' })];
    mockResolveFromRawText.mockReturnValue(
      makeResolvedIngredients({ resolvedActiveKeys: [], unresolvedIngredientTokens: [] }),
    );
    renderScreen();

    expect(screen.queryByText(/nothing to show/i)).toBeNull();
    expect(screen.queryByText(/nothing here yet/i)).toBeNull();
    // Each section still independently renders its OWN real empty-state.
    expect(screen.getByText(/no known functional tags detected/i)).toBeTruthy();
    expect(
      within(screen.getByTestId('detected-actives')).getByText(/no.*active ingredients.*detected/i),
    ).toBeTruthy();
    expect(screen.getByTestId('explore-result-disclaimer')).toBeTruthy();
  });
});

// ── Notes card (spec Story 9 AC8-10) ──────────────────────────────────────────

describe('Notes card: starts from the entry\'s existing notes (or empty), commits on blur via wishlistStore.updateEntry', () => {
  it('shows an empty text area with a placeholder when the entry has no notes yet', () => {
    mockEntries = [makeWishlistEntry({ id: 'entry-1', notes: null })];
    renderScreen();

    const input = screen.getByTestId('wishlist-notes-input');
    expect(input.props.value ?? '').toBe('');
    expect(input.props.placeholder).toBeTruthy();
  });

  it('shows the previously-saved note text when reopening the entry — never pre-filled with fabricated text', () => {
    mockEntries = [makeWishlistEntry({ id: 'entry-1', notes: 'Smells amazing, buy again' })];
    renderScreen();

    expect(screen.getByTestId('wishlist-notes-input').props.value).toBe('Smells amazing, buy again');
  });

  it('persists the new text to this exact entry via wishlistStore.updateEntry on blur, changing no other field', () => {
    mockEntries = [makeWishlistEntry({ id: 'entry-1', notes: null })];
    renderScreen();

    const input = screen.getByTestId('wishlist-notes-input');
    fireEvent.changeText(input, 'Great texture, light finish');
    fireEvent(input, 'blur');

    expect(mockUpdateEntry).toHaveBeenCalledTimes(1);
    expect(mockUpdateEntry).toHaveBeenCalledWith('entry-1', { notes: 'Great texture, light finish' });
  });

  it('does not call updateEntry when the text on blur is unchanged from what was last saved', () => {
    mockEntries = [makeWishlistEntry({ id: 'entry-1', notes: 'Already saved' })];
    renderScreen();

    fireEvent(screen.getByTestId('wishlist-notes-input'), 'blur');

    expect(mockUpdateEntry).not.toHaveBeenCalled();
  });
});

// ── Footer: Move to Shelf / Delete (spec Story 9 AC11-14) ─────────────────────

describe('Footer actions: Move to Shelf / Delete, additive to WishlistEntryCard\'s own versions', () => {
  it('"Move to Shelf" navigates to ManualProductForm with the identical explorePrefill payload CatalogScreen\'s own handlePromoteWishlistEntry builds', () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByText('Move to Shelf'));

    expect(navigation.navigate).toHaveBeenCalledWith('ManualProductForm', {
      explorePrefill: {
        rawIngredientsText: RAW_TEXT,
        activeKeys: ['niacinamide', 'hyaluronic_acid'],
        brand: 'Some Brand',
        name: 'Some Serum',
        category: 'serum',
        wishlistEntryId: 'entry-1',
      },
    });
  });

  it('does not remove the entry itself on "Move to Shelf" — removal only happens after a successful save in the completion form (Story 5 AC3)', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Move to Shelf'));

    expect(mockRemoveEntry).not.toHaveBeenCalled();
  });

  it('"Delete" removes the entry and navigates back immediately, with no confirmation modal — same rule as the card', () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByText('Delete'));

    expect(mockRemoveEntry).toHaveBeenCalledWith('entry-1');
    expect(navigation.goBack).toHaveBeenCalled();
    expect(screen.queryByTestId('delete-product-modal')).toBeNull();
    expect(screen.queryByText('Remove product?')).toBeNull();
  });

  it('renders both actions in addition to — not instead of — WishlistEntryCard\'s own versions', () => {
    renderScreen();

    expect(screen.getByText('Move to Shelf')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });
});
