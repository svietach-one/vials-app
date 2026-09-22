import type { WishlistEntry } from '@/types';

const mockLoadJson = jest.fn();
const mockSaveJson = jest.fn();

jest.mock('@/services/storage', () => ({
  loadJson: (...args: unknown[]) => mockLoadJson(...args),
  saveJson: (...args: unknown[]) => mockSaveJson(...args),
  STORAGE_KEYS: { wishlistEntries: '@vials/wishlistEntries' },
}));

import { useWishlistStore } from '@/store/wishlistStore';

function makeEntry(overrides: Partial<WishlistEntry> = {}): WishlistEntry {
  return {
    id: 'wishlist-entry-1',
    brand: 'Some Brand',
    name: 'Some Serum',
    category: 'serum',
    rawIngredientsText: 'Aqua, Niacinamide, Glycerin',
    parsedIngredientIds: ['niacinamide'],
    sourceFlow: 'explore_composition',
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadJson.mockResolvedValue([]);
  useWishlistStore.setState({ entries: [], hydrated: false });
});

describe('initial state', () => {
  it('starts with an empty, unhydrated store', () => {
    const state = useWishlistStore.getState();

    expect(state.entries).toEqual([]);
    expect(state.hydrated).toBe(false);
  });
});

describe('hydrate', () => {
  it('loads persisted entries from storage under the wishlistEntries key', async () => {
    const persisted = [makeEntry()];
    mockLoadJson.mockResolvedValue(persisted);

    await useWishlistStore.getState().hydrate();

    expect(mockLoadJson).toHaveBeenCalledWith('@vials/wishlistEntries', []);
    expect(useWishlistStore.getState().entries).toEqual(persisted);
    expect(useWishlistStore.getState().hydrated).toBe(true);
  });

  it('defaults to an empty array when nothing is persisted yet', async () => {
    mockLoadJson.mockResolvedValue([]);

    await useWishlistStore.getState().hydrate();

    expect(useWishlistStore.getState().entries).toEqual([]);
    expect(useWishlistStore.getState().hydrated).toBe(true);
  });
});

describe('addEntry', () => {
  it('appends the entry to state and persists the resulting array', () => {
    const entry = makeEntry();

    useWishlistStore.getState().addEntry(entry);

    expect(useWishlistStore.getState().entries).toEqual([entry]);
    expect(mockSaveJson).toHaveBeenCalledWith('@vials/wishlistEntries', [entry]);
  });

  it('keeps previously added entries when a second one is added', () => {
    const first = makeEntry({ id: 'wishlist-entry-1' });
    const second = makeEntry({ id: 'wishlist-entry-2', name: 'Another Serum' });

    useWishlistStore.getState().addEntry(first);
    useWishlistStore.getState().addEntry(second);

    expect(useWishlistStore.getState().entries).toEqual([first, second]);
  });
});

describe('removeEntry', () => {
  it('removes only the entry matching the given id', () => {
    const keep = makeEntry({ id: 'wishlist-entry-keep' });
    const remove = makeEntry({ id: 'wishlist-entry-remove' });
    useWishlistStore.setState({ entries: [keep, remove], hydrated: true });

    useWishlistStore.getState().removeEntry('wishlist-entry-remove');

    expect(useWishlistStore.getState().entries).toEqual([keep]);
    expect(mockSaveJson).toHaveBeenCalledWith('@vials/wishlistEntries', [keep]);
  });

  it('is a no-op on entries when the id does not match anything', () => {
    const entry = makeEntry();
    useWishlistStore.setState({ entries: [entry], hydrated: true });

    useWishlistStore.getState().removeEntry('does-not-exist');

    expect(useWishlistStore.getState().entries).toEqual([entry]);
  });
});

describe('updateEntry', () => {
  it('patches only the matching entry and persists the resulting array (FE-17)', () => {
    const target = makeEntry({ id: 'wishlist-entry-1', notes: null });
    const other = makeEntry({ id: 'wishlist-entry-2', name: 'Another Serum', notes: null });
    useWishlistStore.setState({ entries: [target, other], hydrated: true });

    useWishlistStore.getState().updateEntry('wishlist-entry-1', { notes: 'Smells amazing' });

    const [updated, untouched] = useWishlistStore.getState().entries;
    expect(updated).toEqual({ ...target, notes: 'Smells amazing' });
    expect(untouched).toEqual(other);
    expect(mockSaveJson).toHaveBeenCalledWith('@vials/wishlistEntries', [
      { ...target, notes: 'Smells amazing' },
      other,
    ]);
  });

  it('round-trips add-then-update-then-read-back, mirroring productsStore.updateProduct coverage', () => {
    const entry = makeEntry({ id: 'wishlist-entry-1', notes: null });
    useWishlistStore.getState().addEntry(entry);

    useWishlistStore.getState().updateEntry('wishlist-entry-1', { notes: 'Great texture' });

    expect(useWishlistStore.getState().entries).toEqual([{ ...entry, notes: 'Great texture' }]);
  });

  it('is a no-op on entries when the id does not match anything', () => {
    const entry = makeEntry();
    useWishlistStore.setState({ entries: [entry], hydrated: true });

    useWishlistStore.getState().updateEntry('does-not-exist', { notes: 'orphan patch' });

    expect(useWishlistStore.getState().entries).toEqual([entry]);
  });

  it('only changes the given field, leaving every other field on the entry untouched', () => {
    const entry = makeEntry({ id: 'wishlist-entry-1', brand: 'Some Brand', name: 'Some Serum' });
    useWishlistStore.setState({ entries: [entry], hydrated: true });

    useWishlistStore.getState().updateEntry('wishlist-entry-1', { notes: 'Just notes' });

    expect(useWishlistStore.getState().entries[0]).toEqual({ ...entry, notes: 'Just notes' });
  });
});

describe('isolation from productsStore / conflictEngine', () => {
  it('never imports productsStore, conflictEngine, or Catalog filter modules', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const source = require('fs').readFileSync(
      require.resolve('@/store/wishlistStore'),
      'utf8',
    ) as string;

    expect(source).not.toMatch(/from ['"].*productsStore['"]/);
    expect(source).not.toMatch(/from ['"].*conflictEngine['"]/);
    expect(source).not.toMatch(/from ['"].*CatalogFilter/);
  });
});
