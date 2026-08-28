/**
 * Unit test — `useCompositionInsights` (Story 9, tech design FE-18).
 *
 * Mocks `productsStore`/`profileStore` at the module boundary and asserts
 * this hook is a pure recomposition of the already-tested builders
 * (`resolveFromRawText`, `joinActiveKeys`, `buildCapabilities`,
 * `buildSkinTypeCaution`, `buildShelfComparison`, `buildRoutinePosition`) —
 * no new detection/matching logic of its own — same convention as
 * FE-9/FE-10/FE-11's own co-located unit tests.
 */
import { renderHook } from '@testing-library/react-native';

let mockProducts: unknown[] = [];
jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

let mockProfile: { skinType: string | null } | null = { skinType: null };
jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: mockProfile })),
}));

import { useCompositionInsights } from '@/hooks/useCompositionInsights';
import { makeProduct } from '../../tests/explore-composition/fixtures';

const RAW_TEXT = 'Aqua, Niacinamide, Hyaluronic Acid';

beforeEach(() => {
  mockProducts = [];
  mockProfile = { skinType: null };
});

describe('resolvedActiveKeys / capabilityTags — real resolve/join/capabilities pipeline, no reimplementation', () => {
  it('exposes the real resolvedActiveKeys for the given raw text', () => {
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.resolvedActiveKeys).toEqual(
      expect.arrayContaining(['niacinamide', 'hyaluronic_acid']),
    );
  });

  it('exposes capability tags derived from the real buildCapabilities output', () => {
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    // Niacinamide/hyaluronic acid resolve to real, positive-score capability
    // tags via the actual (unmocked) capabilities.ts pipeline.
    expect(result.current.capabilityTags.length).toBeGreaterThan(0);
  });

  it('returns no resolved keys or capability tags for text with nothing recognizable', () => {
    const { result } = renderHook(() => useCompositionInsights('Aqua, Xanthan Weirdum', null));

    expect(result.current.resolvedActiveKeys).toEqual([]);
    expect(result.current.capabilityTags).toEqual([]);
  });
});

describe('skinType / skinTypeCaution — reads profileStore, delegates to buildSkinTypeCaution', () => {
  it('exposes profile.skinType as-is', () => {
    mockProfile = { skinType: 'oily' };
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.skinType).toBe('oily');
  });

  it('exposes null skinType when the profile has none set', () => {
    mockProfile = { skinType: null };
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.skinType).toBeNull();
  });

  it('fires the caution for a known trigger class (aha) regardless of null skinType (suppression is the caller\'s job, not this hook\'s)', () => {
    const { result } = renderHook(() => useCompositionInsights('Aqua, Glycolic Acid', null));

    expect(result.current.skinTypeCaution).not.toBeNull();
  });

  it('does not fire the caution for a composition with no triggering class', () => {
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.skinTypeCaution).toBeNull();
  });
});

describe('shelfComparison / routinePosition — gated on category, reads productsStore', () => {
  it('is null for both when category is null, never calling the category-only builders', () => {
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.shelfComparison).toBeNull();
    expect(result.current.routinePosition).toBeNull();
  });

  it('computes a real shelfComparison and routinePosition when category is set', () => {
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, 'serum'));

    expect(result.current.shelfComparison).not.toBeNull();
    expect(result.current.shelfComparison?.category).toBe('serum');
    expect(result.current.routinePosition).not.toBeNull();
  });

  it('reflects productsStore.products read fresh — a zero-item shelf renders the zero-items population', () => {
    mockProducts = [];
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, 'serum'));

    expect(result.current.shelfComparison?.sameCategoryCount).toBe(0);
  });
});
