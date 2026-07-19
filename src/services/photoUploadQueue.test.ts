/**
 * Unit tests — photo upload queue (img-01). Storage is replaced with an
 * in-memory map (no AsyncStorage native module), and expo-file-system is
 * mocked at the module boundary. Contract under test: round-trip persistence,
 * and drain semantics (success drops entry + deletes file; failure bumps
 * attempts and keeps everything).
 */
import {
  drain,
  enqueue,
  getAll,
  noopTransport,
  remove,
  type PhotoUploadTransport,
} from '@/services/photoUploadQueue';
import type { PhotoUploadQueueEntry } from '@/types';

const mockStore: Record<string, string> = {};

jest.mock('@/services/storage', () => ({
  STORAGE_KEYS: { photoUploadQueue: '@vials/photoUploadQueue' },
  loadJson: jest.fn(async (key: string, fallback: unknown) =>
    key in mockStore ? JSON.parse(mockStore[key]) : fallback,
  ),
  saveJson: jest.fn(async (key: string, value: unknown) => {
    mockStore[key] = JSON.stringify(value);
  }),
}));

const mockFileDelete = jest.fn();
let mockFileExists = true;

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((path: string) => ({
    uri: path,
    get exists() {
      return mockFileExists;
    },
    delete: mockFileDelete,
  })),
}));

function makeEntry(overrides: Partial<PhotoUploadQueueEntry> = {}): PhotoUploadQueueEntry {
  return {
    productId: 'p1',
    filePath: 'file:///doc/pending-uploads/p1.jpg',
    createdAt: '2026-07-19T00:00:00.000Z',
    attempts: 0,
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  mockFileDelete.mockClear();
  mockFileExists = true;
});

describe('photoUploadQueue persistence', () => {
  it('round-trips enqueue → getAll → remove', async () => {
    await enqueue(makeEntry({ productId: 'a' }));
    await enqueue(makeEntry({ productId: 'b' }));

    expect((await getAll()).map((e) => e.productId)).toEqual(['a', 'b']);

    await remove('a');
    expect((await getAll()).map((e) => e.productId)).toEqual(['b']);
  });

  it('replaces the pending entry when the same product is re-enqueued', async () => {
    await enqueue(makeEntry({ productId: 'a', filePath: 'old.jpg' }));
    await enqueue(makeEntry({ productId: 'a', filePath: 'new.jpg' }));

    const all = await getAll();
    expect(all).toHaveLength(1);
    expect(all[0].filePath).toBe('new.jpg');
  });
});

describe('drain', () => {
  it('removes the entry and deletes the file on a successful upload', async () => {
    await enqueue(makeEntry({ productId: 'a' }));
    const transport: PhotoUploadTransport = {
      upload: jest.fn(async () => ({ remoteUrl: 'https://cdn/a.jpg' })),
    };

    await drain(transport);

    expect(transport.upload).toHaveBeenCalledTimes(1);
    expect(mockFileDelete).toHaveBeenCalledTimes(1);
    expect(await getAll()).toEqual([]);
  });

  it('increments attempts and keeps the entry + file on a failed upload', async () => {
    await enqueue(makeEntry({ productId: 'a', attempts: 0 }));
    const transport: PhotoUploadTransport = {
      upload: jest.fn(async () => {
        throw new Error('network down');
      }),
    };

    await drain(transport);

    const all = await getAll();
    expect(all).toHaveLength(1);
    expect(all[0].attempts).toBe(1);
    expect(all[0].lastAttemptAt).toBeDefined();
    expect(mockFileDelete).not.toHaveBeenCalled();
  });

  it('is a silent no-op with the stub noopTransport (keeps entries, bumps attempts)', async () => {
    await enqueue(makeEntry({ productId: 'a', attempts: 0 }));

    await expect(drain(noopTransport)).resolves.toBeUndefined();

    const all = await getAll();
    expect(all).toHaveLength(1);
    expect(all[0].attempts).toBe(1);
    expect(mockFileDelete).not.toHaveBeenCalled();
  });

  it('does nothing when the queue is empty', async () => {
    const transport: PhotoUploadTransport = { upload: jest.fn() };
    await drain(transport);
    expect(transport.upload).not.toHaveBeenCalled();
  });
});
