const mockLoadJson = jest.fn();
const mockSaveJson = jest.fn();

jest.mock('@/services/storage', () => ({
  loadJson: (...args: unknown[]) => mockLoadJson(...args),
  saveJson: (...args: unknown[]) => mockSaveJson(...args),
  STORAGE_KEYS: { completions: '@vials/completions' },
}));

import { useCompletionStore } from '@/store/completionStore';

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadJson.mockResolvedValue([]);
  useCompletionStore.setState({ completions: [], hydrated: false });
});

describe('initial state', () => {
  it('starts with no completions and unhydrated', () => {
    const state = useCompletionStore.getState();
    expect(state.completions).toEqual([]);
    expect(state.hydrated).toBe(false);
  });
});

describe('hydrate', () => {
  it('loads persisted completions under the completions key', async () => {
    const persisted = [{ productId: 'p1', routineId: 'r1', date: '2026-08-20' }];
    mockLoadJson.mockResolvedValue(persisted);

    await useCompletionStore.getState().hydrate();

    expect(mockLoadJson).toHaveBeenCalledWith('@vials/completions', []);
    expect(useCompletionStore.getState().completions).toEqual(persisted);
    expect(useCompletionStore.getState().hydrated).toBe(true);
  });
});

describe('isCompleted', () => {
  it('returns false when no matching record exists', () => {
    expect(useCompletionStore.getState().isCompleted('p1', 'r1', '2026-08-20')).toBe(false);
  });

  it('returns true only for an exact (productId, routineId, date) match', () => {
    useCompletionStore.setState({
      completions: [{ productId: 'p1', routineId: 'r1', date: '2026-08-20' }],
      hydrated: true,
    });
    expect(useCompletionStore.getState().isCompleted('p1', 'r1', '2026-08-20')).toBe(true);
    expect(useCompletionStore.getState().isCompleted('p1', 'r1', '2026-08-21')).toBe(false);
    expect(useCompletionStore.getState().isCompleted('p1', 'r2', '2026-08-20')).toBe(false);
    expect(useCompletionStore.getState().isCompleted('p2', 'r1', '2026-08-20')).toBe(false);
  });

  it('does not conflate the same product across two different routines (period is not the key, routineId is)', () => {
    useCompletionStore.setState({
      completions: [{ productId: 'p1', routineId: 'routine-am', date: '2026-08-20' }],
      hydrated: true,
    });
    expect(useCompletionStore.getState().isCompleted('p1', 'routine-pm', '2026-08-20')).toBe(false);
  });
});

describe('toggleCompleted', () => {
  it('adds a record when none exists, and persists it', () => {
    useCompletionStore.getState().toggleCompleted('p1', 'r1', '2026-08-20');

    expect(useCompletionStore.getState().completions).toEqual([
      { productId: 'p1', routineId: 'r1', date: '2026-08-20' },
    ]);
    expect(mockSaveJson).toHaveBeenCalledWith('@vials/completions', [
      { productId: 'p1', routineId: 'r1', date: '2026-08-20' },
    ]);
  });

  it('removes the record on a second toggle', () => {
    useCompletionStore.getState().toggleCompleted('p1', 'r1', '2026-08-20');
    useCompletionStore.getState().toggleCompleted('p1', 'r1', '2026-08-20');

    expect(useCompletionStore.getState().completions).toEqual([]);
  });

  it('leaves other records untouched when toggling one', () => {
    useCompletionStore.setState({
      completions: [{ productId: 'other', routineId: 'r1', date: '2026-08-20' }],
      hydrated: true,
    });
    useCompletionStore.getState().toggleCompleted('p1', 'r1', '2026-08-20');

    expect(useCompletionStore.getState().completions).toEqual([
      { productId: 'other', routineId: 'r1', date: '2026-08-20' },
      { productId: 'p1', routineId: 'r1', date: '2026-08-20' },
    ]);
  });
});
