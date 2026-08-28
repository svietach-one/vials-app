/**
 * Component tests — ExploreCompositionResultScreen (FE-4, extended by the
 * 2026-08-26 decision batch: FE-9..FE-14).
 * Spec: docs/specs/explore-composition.md §4 Story 2 (AC1-3), Story 3 (AC1),
 *       Story 4 (AC1), Story 6 (comparison matrix), Story 7 (skin-type
 *       caution), Story 8 (routine placement), §3 Non-Goals (incl. the
 *       2026-08-26 reversal note), §5
 * Tech design: docs/tech-design/explore-composition.md §3 FE-4/FE-9..FE-14,
 *       §4 (assumptions, incl. the 2026-08-26 decision batch)
 * Source brief: docs/tasks/00-explore-composition-spec.md §3 "Explicitly
 *       excluded from this screen"
 *
 * `src/screens/catalog/ExploreCompositionResultScreen.tsx` and
 * `resolveFromRawText` (`src/utils/productProfile/resolve.ts`) already exist
 * (first slice, PR_REVIEW). This second slice's new sections
 * (`CompositionComparisonMatrix`, `SkinTypeCautionNotice`,
 * `RoutinePlacementCard`, the shared tokenizer promotion) do NOT exist yet —
 * every new describe block below (Story 6/7/8) is EXPECTED to fail until
 * FE-9..FE-14 land, same convention as the first slice.
 *
 * Pipeline mocking strategy: only the FE-3 boundary (`resolveFromRawText`) is
 * mocked — `joinActiveKeys` and `buildCapabilities` run for REAL, so the
 * rendered functional-profile tags AND the new comparison-matrix numbers
 * reflect the actual, already-shipped capability logic, not a fabricated
 * stub. The heavier orchestrator pieces this screen must NEVER reach
 * (`buildIrritationProfile`, `buildSensitivityCompatibility`, and the
 * `buildProductProfileFrom*` orchestrators) are spied on with their real
 * implementations (jest.fn(actual)) so a call count of zero is a real
 * assertion, not just "the mock returned undefined".
 *
 * **DELIBERATE REVERSAL, not a silent test change:** `buildRoutinePosition`
 * was PREVIOUSLY asserted "never called" in this same file (first slice's
 * non-goal). Story 8 of this second slice explicitly and deliberately
 * reverses that non-goal — human-approved, documented in
 * docs/specs/explore-composition.md §3's 2026-08-26 reversal note and in
 * docs/tech-design/explore-composition.md's qa-lead task callout. The old
 * "never called" line has been REMOVED from the shared orchestrator-exclusion
 * test below (the other 4 exclusions in that test are unaffected and remain
 * "never called") and REPLACED with the "Story 8: routine placement" describe
 * block further down, which asserts the opposite: called with exactly
 * `(category, classFacts)` when a category is present, never called when it
 * is absent.
 *
 * New testID contracts introduced by this file (components don't exist yet —
 * judgment calls, flagged for engineer/tech-lead to confirm or override, same
 * convention as the first slice's `explore-result-disclaimer` /
 * `wishlist-entry-save-confirm`):
 *   - `composition-comparison-matrix`: Story 6's matrix wrapper. Present
 *     whenever `category` is set (whether populated or in its zero-items
 *     message state) — absent only when `category` is `null`.
 *   - `matrix-row-functional-breadth` / `matrix-row-ingredient-count` /
 *     `matrix-row-active-tags` / `matrix-row-category-signal`: the matrix's 4
 *     rows, present only when at least one same-category Shelf item exists.
 *   - `skin-type-caution`: Story 7's caution wrapper. Present only when the
 *     trigger fires AND `profile.skinType` is non-null.
 *   - `routine-placement`: Story 8's placement wrapper. Present only when
 *     `category` is set.
 *
 * No disclaimer-footer component was found already shipped anywhere in
 * `src/` (grepped for "disclaimer"/"dermatologist"/"educational purposes") —
 * despite tech design FE-4 saying to "reuse the existing disclaimer-footer
 * component/copy". This is flagged as a gap for engineer/tech-lead: the
 * disclaimer assertion below only checks that SOME footer disclaimer text
 * renders (via testID), not any specific copy.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { Product } from '@/types';

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

// FE-3 boundary — the only piece of the pipeline mocked. join.ts/capabilities.ts
// run for real (imported, not mocked) so this stays an integration test of the
// real reconciled capability logic.
const mockResolveFromRawText = jest.fn();
jest.mock('@/utils/productProfile/resolve', () => ({
  ...jest.requireActual('@/utils/productProfile/resolve'),
  resolveFromRawText: (...args: unknown[]) => mockResolveFromRawText(...args),
}));

// Excluded-orchestrator spies — real implementations, so "0 calls" is a
// meaningful assertion (spec §3 Non-Goals / source brief §3's exclusion list).
// `buildRoutinePosition` is ALSO spied here (not excluded from the module
// mock) because Story 8 now needs to assert it IS called — see the
// deliberate-reversal note at the top of this file.
jest.mock('@/utils/productProfile/irritation', () => {
  const actual = jest.requireActual('@/utils/productProfile/irritation');
  return {
    buildIrritationProfile: jest.fn(actual.buildIrritationProfile),
    buildSensitivityCompatibility: jest.fn(actual.buildSensitivityCompatibility),
  };
});
jest.mock('@/utils/productProfile/routinePosition', () => {
  const actual = jest.requireActual('@/utils/productProfile/routinePosition');
  return { buildRoutinePosition: jest.fn(actual.buildRoutinePosition) };
});
jest.mock('@/utils/productProfile', () => {
  const actual = jest.requireActual('@/utils/productProfile');
  return {
    ...actual,
    buildProductProfileFromProduct: jest.fn(actual.buildProductProfileFromProduct),
    buildProductProfileFromActiveKeys: jest.fn(actual.buildProductProfileFromActiveKeys),
  };
});

// Story 6 AC ("Active tags is resolved.resolvedActiveKeys directly — never
// getProductActiveKeys()") guardrail spy. Real implementation kept for every
// other export so resolve.ts's own real internals (still exercised via the
// resolve.ts mock's `...jest.requireActual` spread above) are unaffected.
jest.mock('@/utils/ingredientParser', () => {
  const actual = jest.requireActual('@/utils/ingredientParser');
  return { ...actual, getProductActiveKeys: jest.fn(actual.getProductActiveKeys) };
});

// Guardrail: conflictEngine.ts must get no new call sites from this flow.
jest.mock('@/utils/conflictEngine', () => ({
  matchPairRule: jest.fn(),
  ConflictEngine: jest.fn().mockImplementation(() => ({})),
}));

const mockAddEntry = jest.fn();
// NOTE: this project's `@/*` jest moduleNameMapper cannot resolve ANY
// mock (real or virtual) for a path with no file on disk (verified
// precedent: tests/inci-attribution-highlighting/DetectedActiveBadgeWiring
// .test.tsx NOTE 2). So this whole suite fails to even resolve until
// FE-5 creates src/store/wishlistStore.ts — expected, not a bug here.
jest.mock('@/store/wishlistStore', () => ({
  useWishlistStore: jest.fn((selector: any) =>
    selector({ entries: [], addEntry: mockAddEntry, removeEntry: jest.fn() }),
  ),
}));

const mockAddProduct = jest.fn();
// `mockProducts` is read fresh by the selector on every render (JS closures
// read the CURRENT binding, not a snapshot at mock-creation time), so tests
// below can reassign it per-case to drive Story 6's Shelf-comparison logic.
let mockProducts: Product[] = [];
// `.getState()` added alongside the selector-hook mock (2026-08-27) — the
// wishlist modal's `BrandAutocompleteInput` -> `brandLookup.ts`'s
// `searchBrands()` reads `useProductsStore.getState().products` directly
// (Zustand's real static-access API), not via the `useProductsStore(selector)`
// hook form the rest of this file already mocks.
const productsStoreState = () => ({
  products: mockProducts,
  addProduct: mockAddProduct,
  updateProduct: jest.fn(),
  removeProduct: jest.fn(),
});
jest.mock('@/store/productsStore', () => ({
  useProductsStore: Object.assign(
    jest.fn((selector: any) => selector(productsStoreState())),
    { getState: () => productsStoreState() },
  ),
}));

// New for this slice (FE-14 reads `useProfileStore((s) => s.profile)` for
// Story 7's skin-type caution). Same reassignable-closure pattern as
// `mockProducts` above.
let mockProfile: { skinType: string | null } = { skinType: null };
jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: mockProfile })),
}));

const mockSubmitContribution = jest.fn();
jest.mock('@/services/contributions', () => ({
  submitContribution: (...args: unknown[]) => mockSubmitContribution(...args),
}));

import ExploreCompositionResultScreen from '@/screens/catalog/ExploreCompositionResultScreen';
import { buildIrritationProfile, buildSensitivityCompatibility } from '@/utils/productProfile/irritation';
import { buildRoutinePosition } from '@/utils/productProfile/routinePosition';
import { buildProductProfileFromProduct, buildProductProfileFromActiveKeys } from '@/utils/productProfile';
import { getProductActiveKeys } from '@/utils/ingredientParser';
import { joinActiveKeys } from '@/utils/productProfile/join';
import { buildCapabilities } from '@/utils/productProfile/capabilities';
import { getSlotCategoryLabelPlural } from '@/constants/labels';
import { ConflictEngine, matchPairRule } from '@/utils/conflictEngine';
import { makeNavigation, makeResolvedIngredients, makeProduct } from './fixtures';

const RAW_TEXT = 'Aqua, Niacinamide, Hyaluronic Acid, Xanthan Weirdum';

function renderScreen(params: Record<string, unknown> = {}) {
  const navigation = makeNavigation();
  render(
    <ExploreCompositionResultScreen
      navigation={navigation}
      route={{ params: { rawIngredientsText: RAW_TEXT, category: null, ...params } } as any}
    />,
  );
  return navigation as { navigate: jest.Mock };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProducts = [];
  mockProfile = { skinType: null };
  mockResolveFromRawText.mockReturnValue(
    makeResolvedIngredients({
      resolvedActiveKeys: ['niacinamide', 'hyaluronic_acid'],
      unresolvedIngredientTokens: ['Xanthan Weirdum'],
    }),
  );
});

// ── Story 2 AC1: only the specified sections render ───────────────────────────

describe('Story 2 AC1: functional profile, Detected actives, and disclaimer render — nothing else', () => {
  it('renders functional-profile tags with no numeric score/percentage attached', () => {
    renderScreen();
    expect(screen.getByText('Soothing')).toBeTruthy();
    expect(screen.getByText('Hydration')).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('renders a disclaimer footer of some kind', () => {
    renderScreen();
    expect(screen.getByTestId('explore-result-disclaimer')).toBeTruthy();
  });

  it('renders no identity/hero card — no brand or product name anywhere', () => {
    renderScreen();
    expect(screen.queryByLabelText(/brand/i)).toBeNull();
    expect(screen.queryByLabelText(/product name/i)).toBeNull();
  });
});

describe('Story 2 (superseded 2026-08-27): Detected actives replaces the full ingredient list', () => {
  it('shows the resolved active ingredient names as a clean "Detected actives" list', () => {
    renderScreen();
    const section = screen.getByTestId('detected-actives');
    expect(within(section).getByText(/detected actives/i)).toBeTruthy();
    expect(within(section).getByText(/niacinamide/i)).toBeTruthy();
    expect(within(section).getByText(/hyaluronic acid/i)).toBeTruthy();
  });

  it('never renders the removed full raw-token list or per-token "not recognized" flags', () => {
    renderScreen();
    // RAW_TEXT's raw tokens/unresolved token must not appear verbatim anywhere.
    expect(screen.queryByText('Aqua')).toBeNull();
    expect(screen.queryByText('Xanthan Weirdum')).toBeNull();
    expect(screen.queryByText(/not recognized/i)).toBeNull();
  });

  it('states plainly, not silently, when no active ingredients are detected at all', () => {
    mockResolveFromRawText.mockReturnValue(
      makeResolvedIngredients({ resolvedActiveKeys: [], unresolvedIngredientTokens: ['Aqua'] }),
    );
    renderScreen();
    const section = screen.getByTestId('detected-actives');
    expect(within(section).getByText(/no.*active ingredients.*detected/i)).toBeTruthy();
  });
});

// ── Story 2 AC3 / source-brief §3 exclusions ──────────────────────────────────

describe('Story 2 AC3: none of the explicitly excluded sections ever render', () => {
  it('shows no % match / identification-confidence badge', () => {
    renderScreen();
    expect(screen.queryByText(/% match/i)).toBeNull();
    expect(screen.queryByTestId('match-confidence-badge')).toBeNull();
  });

  it('shows no conflict warning, and never calls conflictEngine', () => {
    renderScreen();
    expect(screen.queryByText(/conflict/i)).toBeNull();
    expect(matchPairRule).not.toHaveBeenCalled();
    expect(ConflictEngine).not.toHaveBeenCalled();
  });

  it('shows no efficacy/quality score or single-number verdict', () => {
    renderScreen();
    expect(screen.queryByText(/quality score/i)).toBeNull();
    expect(screen.queryByText(/efficacy/i)).toBeNull();
  });

  it('shows no per-concern percentages', () => {
    renderScreen();
    expect(screen.queryByText(/effective for/i)).toBeNull();
  });

  it('shows no allergen/fragrance/preservative breakdown', () => {
    renderScreen();
    expect(screen.queryByText(/allergen/i)).toBeNull();
    expect(screen.queryByText(/fragrance/i)).toBeNull();
  });

  it('shows no usage/application section', () => {
    renderScreen();
    expect(screen.queryByText(/how to apply/i)).toBeNull();
    expect(screen.queryByText(/wait time/i)).toBeNull();
  });

  // Reworded from the first slice's version, which also asserted
  // `buildRoutinePosition` here. That assertion is a DELIBERATE REVERSAL, not
  // a silent drop — see this file's top-of-file note and spec §3's
  // 2026-08-26 reversal note. `buildRoutinePosition`'s (now inverted)
  // behavior is covered in the "Story 8: routine placement" describe block
  // below instead.
  it('never calls the excluded orchestrator/irritation builders (buildIrritationProfile, buildSensitivityCompatibility, buildProductProfileFrom*)', () => {
    renderScreen();
    expect(buildIrritationProfile).not.toHaveBeenCalled();
    expect(buildSensitivityCompatibility).not.toHaveBeenCalled();
    expect(buildProductProfileFromProduct).not.toHaveBeenCalled();
    expect(buildProductProfileFromActiveKeys).not.toHaveBeenCalled();
  });
});

// ── Story 3: Save to Wishlist ─────────────────────────────────────────────────

describe('Story 3 AC1: Save to Wishlist prompts for brand+name and stays fully isolated', () => {
  it('always renders both footer actions', () => {
    renderScreen();
    expect(screen.getByText('Put on Shelf')).toBeTruthy();
    expect(screen.getByText('Add to Wishlist')).toBeTruthy();
  });

  it('prompts for brand and name, both starting empty and both required', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Add to Wishlist'));

    // Exact labels "Brand" / "Name" on the modal's own inputs — distinct from
    // any other screen, so no ambiguity risk within this test file. Contract
    // fixed here (not specified verbatim in the tech design) since qa-lead
    // tests run before the modal exists.
    const brandInput = screen.getByLabelText('Brand');
    const nameInput = screen.getByLabelText('Name');
    expect(brandInput.props.value ?? '').toBe('');
    expect(nameInput.props.value ?? '').toBe('');
  });

  it('creates a WishlistEntry on submit, touching neither productsStore, conflictEngine, nor community contribution', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Add to Wishlist'));
    fireEvent.changeText(screen.getByLabelText('Brand'), 'Some Brand');
    // BrandAutocompleteInput (2026-08-27) only commits the typed value to
    // this screen's state on blur/submit, not on every keystroke — same
    // pattern already established in
    // tests/add-product-flow/AddProductScreen.integration.test.tsx.
    fireEvent(screen.getByLabelText('Brand'), 'blur');
    fireEvent.changeText(screen.getByLabelText('Name'), 'Some Serum');
    // A dedicated testID for the modal's own confirm action — the footer
    // already has an "Add to Wishlist" button, so a text-only query here
    // would be ambiguous once the modal renders on top of it.
    fireEvent.press(screen.getByTestId('wishlist-entry-save-confirm'));

    expect(mockAddEntry).toHaveBeenCalledTimes(1);
    expect(mockAddEntry.mock.calls[0][0]).toMatchObject({
      brand: 'Some Brand',
      name: 'Some Serum',
      rawIngredientsText: RAW_TEXT,
      parsedIngredientIds: ['niacinamide', 'hyaluronic_acid'],
      sourceFlow: 'explore_composition',
    });

    expect(mockAddProduct).not.toHaveBeenCalled();
    expect(mockSubmitContribution).not.toHaveBeenCalled();
    expect(matchPairRule).not.toHaveBeenCalled();
    expect(ConflictEngine).not.toHaveBeenCalled();
  });

  it('carries the captured category through to the WishlistEntry when one was chosen at capture time', () => {
    renderScreen({ category: 'serum' });
    fireEvent.press(screen.getByText('Add to Wishlist'));
    fireEvent.changeText(screen.getByLabelText('Brand'), 'Some Brand');
    fireEvent(screen.getByLabelText('Brand'), 'blur');
    fireEvent.changeText(screen.getByLabelText('Name'), 'Some Serum');
    fireEvent.press(screen.getByTestId('wishlist-entry-save-confirm'));

    expect(mockAddEntry.mock.calls[0][0]).toMatchObject({ category: 'serum' });
  });
});

// ── Story 4: Put on My Shelf ───────────────────────────────────────────────────

describe('Story 4 AC1: Put on My Shelf opens the shared completion form, never re-asking for ingredients', () => {
  it('navigates to ManualProductForm with an explorePrefill carrying the resolved ingredients, no wishlistEntryId', () => {
    const navigation = renderScreen({ category: 'serum' });
    fireEvent.press(screen.getByText('Put on Shelf'));

    expect(navigation.navigate).toHaveBeenCalledWith('ManualProductForm', {
      explorePrefill: expect.objectContaining({
        rawIngredientsText: RAW_TEXT,
        activeKeys: ['niacinamide', 'hyaluronic_acid'],
        brand: null,
        name: null,
        category: 'serum',
      }),
    });
  });

  it('never calls addProduct/submitContribution itself — that belongs to the completion form on its own submit', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Put on Shelf'));

    expect(mockAddProduct).not.toHaveBeenCalled();
    expect(mockSubmitContribution).not.toHaveBeenCalled();
  });
});

// ── Story 6: Comparison matrix (2026-08-26 decision batch, FE-9/FE-10/FE-13/FE-14) ──

describe('Story 6: comparison matrix — exactly 4 parameters, category-filtered Shelf comparison', () => {
  it('renders exactly 4 comparison rows — no 5th slot, no position/concentration/skin-type row', () => {
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];
    renderScreen({ category: 'serum' });

    const matrix = screen.getByTestId('composition-comparison-matrix');
    const rows = screen.getAllByTestId(/^matrix-row-/);
    expect(rows).toHaveLength(4);

    expect(
      within(screen.getByTestId('matrix-row-functional-breadth')).getByText(/functional profile breadth/i),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('matrix-row-ingredient-count')).getByText(/ingredient count/i),
    ).toBeTruthy();
    expect(within(screen.getByTestId('matrix-row-active-tags')).getByText(/active tags/i)).toBeTruthy();
    expect(within(screen.getByTestId('matrix-row-category-signal')).getByText(/category/i)).toBeTruthy();

    expect(within(matrix).queryByText(/position/i)).toBeNull();
    expect(within(matrix).queryByText(/concentration/i)).toBeNull();
    expect(within(matrix).queryByText(/skin type/i)).toBeNull();
    expect(within(matrix).queryByText(/suitability/i)).toBeNull();
  });

  it('computes "Functional profile breadth" as the same distinct-capability count already driving the Functional Profile tag list — not new detection logic', () => {
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];
    renderScreen({ category: 'serum' });

    // Independently derived via the SAME real join.ts/capabilities.ts
    // functions the screen itself uses, per Story 6 AC5 ("neither is
    // computed by new detection logic") — not a hardcoded guess.
    const classFacts = joinActiveKeys(['niacinamide', 'hyaluronic_acid'], {});
    const capabilities = buildCapabilities(['niacinamide', 'hyaluronic_acid'], classFacts);
    const expectedBreadth = Object.values(capabilities).filter(
      (c) => c.score !== null && c.score > 0,
    ).length;

    const row = screen.getByTestId('matrix-row-functional-breadth');
    expect(within(row).getByText(String(expectedBreadth))).toBeTruthy();
  });

  it('computes "Ingredient count" as the total raw comma-tokens (2026-08-27: no longer shown as an on-screen list, but the count itself is unchanged)', () => {
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];
    renderScreen({ category: 'serum' }); // RAW_TEXT has 4 comma-separated tokens

    const row = screen.getByTestId('matrix-row-ingredient-count');
    expect(within(row).getByText('4')).toBeTruthy();
  });

  it('computes "Active tags" directly from resolveFromRawText\'s resolvedActiveKeys — never via getProductActiveKeys()', () => {
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];
    renderScreen({ category: 'serum' });

    const row = screen.getByTestId('matrix-row-active-tags');
    expect(within(row).getByText(/niacinamide/i)).toBeTruthy();
    expect(within(row).getByText(/hyaluronic acid/i)).toBeTruthy();
    expect(getProductActiveKeys).not.toHaveBeenCalled();
  });

  it('filters the Shelf-comparison population to the captured category only, nothing else', () => {
    mockProducts = [
      makeProduct({ id: 'p1', productType: 'serum' }),
      makeProduct({ id: 'p2', productType: 'cleanser' }),
    ];
    renderScreen({ category: 'serum' });

    const row = screen.getByTestId('matrix-row-category-signal');
    // Exactly 1 same-category (serum) item counted — the cleanser is excluded.
    expect(within(row).getByText('1')).toBeTruthy();
  });

  it('shows a plain "no other [category] on your Shelf yet" message, never fabricated numbers, when zero same-category Shelf items exist', () => {
    mockProducts = [makeProduct({ id: 'p2', productType: 'cleanser' })]; // different category only
    renderScreen({ category: 'serum' });

    expect(
      screen.getByText(
        new RegExp(`no other ${getSlotCategoryLabelPlural('serum')} on your shelf yet`, 'i'),
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('matrix-row-functional-breadth')).toBeNull();
    expect(screen.queryByTestId('matrix-row-ingredient-count')).toBeNull();
    expect(screen.queryByTestId('matrix-row-active-tags')).toBeNull();
    expect(screen.queryByTestId('matrix-row-category-signal')).toBeNull();
  });

  it('renders no comparison matrix at all when no category was captured (same gating rule as the first slice)', () => {
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];
    renderScreen({ category: null });

    expect(screen.queryByTestId('composition-comparison-matrix')).toBeNull();
  });
});

// ── Story 7: Skin-type caution (2026-08-26 decision batch, FE-11/FE-13/FE-14) ──

describe('Story 7: skin-type caution — fires only on exfoliating/photosensitizing/irritancy>=3, regardless of barrierRepair', () => {
  it("renders a real sentence naming the triggering active and the user's skin type, even when a barrierRepair active is also present", () => {
    mockProfile = { skinType: 'oily' };
    mockResolveFromRawText.mockReturnValue(
      makeResolvedIngredients({
        // 'aha' -> exfoliating:true/photosensitizing:true/irritancy:3 (fires).
        // 'niacinamide' -> barrierRepair:true, otherwise non-triggering. The
        // "loosened" 15.2% logic must fire anyway (spec Story 7 AC1 / tech
        // design's "flat irritancy tier" assumption) — barrierRepair
        // presence must NOT suppress it.
        resolvedActiveKeys: ['aha', 'niacinamide'],
        unresolvedIngredientTokens: [],
      }),
    );
    renderScreen({ category: null });

    const caution = screen.getByTestId('skin-type-caution');
    expect(within(caution).getByText(/aha acids/i)).toBeTruthy();
    expect(within(caution).getByText(/oily/i)).toBeTruthy();
  });

  it('renders nothing at all — no placeholder, no hidden markup — when no resolved active meets the trigger', () => {
    mockProfile = { skinType: 'oily' };
    mockResolveFromRawText.mockReturnValue(
      makeResolvedIngredients({
        // Neither niacinamide nor hyaluronic_acid is exfoliating,
        // photosensitizing, or irritancy>=3 (actives.json).
        resolvedActiveKeys: ['niacinamide', 'hyaluronic_acid'],
        unresolvedIngredientTokens: [],
      }),
    );
    renderScreen();

    expect(screen.queryByTestId('skin-type-caution')).toBeNull();
    expect(screen.queryByText(/may cause irritation/i)).toBeNull();
    expect(screen.queryByText(/needs extra care/i)).toBeNull();
  });

  it('suppresses the caution entirely when profile.skinType is null, even though the trigger condition is otherwise met', () => {
    mockProfile = { skinType: null };
    mockResolveFromRawText.mockReturnValue(
      makeResolvedIngredients({ resolvedActiveKeys: ['aha'], unresolvedIngredientTokens: [] }),
    );
    renderScreen();

    expect(screen.queryByTestId('skin-type-caution')).toBeNull();
  });

  it('renders independently of category — never gated by whether the matrix/routine-placement sections are present', () => {
    mockProfile = { skinType: 'dry' };
    mockResolveFromRawText.mockReturnValue(
      makeResolvedIngredients({ resolvedActiveKeys: ['aha'], unresolvedIngredientTokens: [] }),
    );
    renderScreen({ category: null }); // no category -> no matrix, no routine placement

    expect(screen.getByTestId('skin-type-caution')).toBeTruthy();
    expect(screen.queryByTestId('composition-comparison-matrix')).toBeNull();
    expect(screen.queryByTestId('routine-placement')).toBeNull();
  });

  it('is a structurally separate block, not a row inside the comparison matrix', () => {
    mockProfile = { skinType: 'oily' };
    mockResolveFromRawText.mockReturnValue(
      makeResolvedIngredients({ resolvedActiveKeys: ['aha'], unresolvedIngredientTokens: [] }),
    );
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];
    renderScreen({ category: 'serum' });

    const matrix = screen.getByTestId('composition-comparison-matrix');
    expect(within(matrix).queryByTestId('skin-type-caution')).toBeNull();
    expect(screen.getByTestId('skin-type-caution')).toBeTruthy();
  });
});

// ── Story 8: Routine placement (2026-08-26 decision batch, FE-12/FE-13/FE-14) ──
//
// DELIBERATE REVERSAL of the first slice's non-goal ("never call
// buildRoutinePosition from this screen") — human-approved, see spec §3's
// 2026-08-26 reversal note and Story 8. `buildRoutinePosition` used to be
// asserted "never called" inside the shared orchestrator-exclusion test
// above (Story 2 AC3); that assertion has been removed from there and
// replaced with its logical opposite here, not silently dropped.
describe('Story 8: routine placement — buildRoutinePosition IS now called when category is set', () => {
  it('calls buildRoutinePosition with exactly (category, classFacts) when a category was captured', () => {
    renderScreen({ category: 'serum' });

    const expectedClassFacts = joinActiveKeys(['niacinamide', 'hyaluronic_acid'], {});
    expect(buildRoutinePosition).toHaveBeenCalledTimes(1);
    expect(buildRoutinePosition).toHaveBeenCalledWith('serum', expectedClassFacts);
  });

  it('does not call buildRoutinePosition when no category was captured (same gating rule as the matrix)', () => {
    renderScreen({ category: null });

    expect(buildRoutinePosition).not.toHaveBeenCalled();
  });

  it('renders the human-readable phase label for the captured category ("Treatment" for a serum, spec §5 example)', () => {
    renderScreen({ category: 'serum' });

    expect(within(screen.getByTestId('routine-placement')).getByText(/treatment/i)).toBeTruthy();
  });

  it('renders "Cleansing" for a cleanser category (spec §5\'s other named example)', () => {
    renderScreen({ category: 'cleanser' });

    expect(within(screen.getByTestId('routine-placement')).getByText(/cleansing/i)).toBeTruthy();
  });

  it('renders no routine-placement element when no category was captured', () => {
    renderScreen({ category: null });

    expect(screen.queryByTestId('routine-placement')).toBeNull();
  });
});
