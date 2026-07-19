/**
 * Service-boundary tests — community contribution write (US-3 MVP).
 * The contributions DB handle is mocked at the module boundary, so no test
 * ever opens a real libSQL connection.
 *
 * Contract under test: a photo is written as a BLOB, a missing photo writes
 * NULL and still succeeds, an unopenable connection is reported as
 * `unavailable` (not a retryable error), a failing write is reported as
 * `error` and never throws, and the row carries product metadata only.
 */
import { getContributionsDb } from '@/services/contributionsDb';
import { CONTRIBUTION_SCHEMA_VERSION, submitContribution } from '@/services/contributions';
import type { SuggestPayload } from '@/types';

jest.mock('@/services/contributionsDb', () => ({
  getContributionsDb: jest.fn(),
}));

const mockGetDb = getContributionsDb as jest.MockedFunction<typeof getContributionsDb>;

function makePayload(overrides: Partial<SuggestPayload> = {}): SuggestPayload {
  return {
    brand: 'CeraVe',
    name: 'Foaming Cleanser',
    productType: 'cleanser',
    barcode: '1234567890123',
    inciRaw: 'Aqua, Glycerin',
    status: 'pending',
    ...overrides,
  };
}

function mockDb(runAsync: jest.Mock) {
  mockGetDb.mockResolvedValue({ runAsync } as never);
  return runAsync;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('submitContribution', () => {
  it('writes one row including the photo blob', async () => {
    const runAsync = mockDb(jest.fn().mockResolvedValue(undefined));
    const blob = new Uint8Array([1, 2, 3, 4]);

    const result = await submitContribution(makePayload(), blob);

    expect(result).toEqual({ status: 'success', withPhoto: true });
    expect(runAsync).toHaveBeenCalledTimes(1);

    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toContain('INSERT INTO contributions');
    // Blob is bound as bytes, not a path or a base64 string.
    expect(params[5]).toBe(blob);
    // Status and schema version are set by the client, not left to defaults.
    expect(sql).toContain("'pending_review'");
    expect(params[params.length - 1]).toBe(CONTRIBUTION_SCHEMA_VERSION);
  });

  it('writes photo_blob as null when there is no photo and still succeeds', async () => {
    const runAsync = mockDb(jest.fn().mockResolvedValue(undefined));

    const result = await submitContribution(makePayload(), null);

    expect(result).toEqual({ status: 'success', withPhoto: false });
    expect(runAsync.mock.calls[0][1][5]).toBeNull();
  });

  it('reports unavailable (not an error) when the connection cannot be opened', async () => {
    mockGetDb.mockResolvedValue(null);
    const result = await submitContribution(makePayload(), null);

    // Distinct from 'error': retrying cannot help in a build without libSQL.
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('reports a failed write as an error instead of throwing', async () => {
    mockDb(jest.fn().mockRejectedValue(new Error('network down')));

    const result = await submitContribution(makePayload(), null);

    expect(result).toEqual({ status: 'error', message: 'network down' });
  });

  it('sends product metadata only — no identity, device or profile fields', async () => {
    const runAsync = mockDb(jest.fn().mockResolvedValue(undefined));

    await submitContribution(makePayload(), null);

    const params = runAsync.mock.calls[0][1] as unknown[];
    // id, brand, name, product_type, inci_raw, photo_blob, created_at, schema_version
    expect(params).toHaveLength(8);
    expect(params).toContain('CeraVe');
    expect(params).toContain('Foaming Cleanser');
    // Nothing resembling a device/user/profile identifier is bound.
    const serialized = JSON.stringify(params.filter((p) => typeof p === 'string'));
    expect(serialized).not.toMatch(/device|user|profile|install|session/i);
  });

  it('generates a fresh row id per submission', async () => {
    const runAsync = mockDb(jest.fn().mockResolvedValue(undefined));

    await submitContribution(makePayload(), null);
    await submitContribution(makePayload(), null);

    const firstId = runAsync.mock.calls[0][1][0];
    const secondId = runAsync.mock.calls[1][1][0];
    expect(firstId).not.toBe(secondId);
  });
});
