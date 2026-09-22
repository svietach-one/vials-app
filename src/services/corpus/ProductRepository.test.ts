import { ProductRepository } from './ProductRepository';
import type { CorpusQueryExecutor } from './types';

function makeFakeDb(rows: unknown[] = []) {
  const getAllAsync = jest.fn().mockResolvedValue(rows);
  const getFirstAsync = jest.fn();
  return { db: { getAllAsync, getFirstAsync } as unknown as CorpusQueryExecutor, getAllAsync };
}

describe('ProductRepository.search', () => {
  it('returns [] without querying the db when the trimmed query is empty', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    const result = await repo.search('   ');

    expect(result).toEqual([]);
    expect(getAllAsync).not.toHaveBeenCalled();
  });

  it('runs the trigram FTS query when the query has a 3+ char token', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search('cera');

    expect(getAllAsync).toHaveBeenCalledTimes(1);
    const [sql] = getAllAsync.mock.calls[0];
    expect(sql).toContain('products_fts');
    expect(sql).toContain('bm25');
  });

  it('falls back to a search_norm substring scan for a 1-2 char query', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search('ce');

    expect(getAllAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).not.toContain('products_fts');
    expect(sql).toContain('search_norm LIKE');
    // 'ce', its lowercase (dup), uppercase, and title-case variants.
    expect(params).toEqual(['%ce%', '%CE%', '%Ce%']);
  });

  it('trims the query before building the fallback params', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search('  a  ');

    const [, params] = getAllAsync.mock.calls[0];
    expect(params).toEqual(['%a%', '%A%']);
  });

  it('matches Cyrillic queries regardless of the source data letter casing', async () => {
    // Regression guard: search_norm's non-ASCII characters keep the source
    // data's original casing (SQL lower() doesn't fold Cyrillic), e.g. a row
    // stored as "Биолит для мужчин" only matches a 'би' query if the
    // capitalized variant ('Би') is tried too.
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search('би');

    const [, params] = getAllAsync.mock.calls[0];
    expect(params).toContain('%Би%');
  });

  it('escapes literal % and _ in the query so they are matched as text, not SQL wildcards', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search('2%');

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain("ESCAPE '\\'");
    expect(params).toEqual(['%2\\%%']);
  });

  it('propagates the error when the underlying query throws, so callers can surface it', async () => {
    const db = {
      getAllAsync: jest.fn().mockRejectedValue(new Error('turso unreachable')),
      getFirstAsync: jest.fn(),
    } as unknown as CorpusQueryExecutor;
    const repo = new ProductRepository(db);

    await expect(repo.search('cera')).rejects.toThrow('turso unreachable');
  });
});

describe('ProductRepository.searchBrands', () => {
  it('returns [] without querying the db when the trimmed prefix is empty', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    const result = await repo.searchBrands('   ');

    expect(result).toEqual([]);
    expect(getAllAsync).not.toHaveBeenCalled();
  });

  it('queries DISTINCT brand with a prefix LIKE pattern, not a substring match', async () => {
    const { db, getAllAsync } = makeFakeDb([{ brand: 'CeraVe' }, { brand: 'Cetaphil' }]);
    const repo = new ProductRepository(db);

    const result = await repo.searchBrands('Cer');

    expect(result).toEqual(['CeraVe', 'Cetaphil']);
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('SELECT DISTINCT brand FROM products');
    expect(sql).toContain('brand LIKE ?');
    expect(params).toContain('Cer%');
  });

  it('escapes LIKE metacharacters in the prefix', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.searchBrands('2%');

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain("ESCAPE '\\'");
    expect(params).toContain('2\\%%');
  });

  it('falls back to an empty list (never throws) when the underlying query fails', async () => {
    const db = {
      getAllAsync: jest.fn().mockRejectedValue(new Error('turso unreachable')),
      getFirstAsync: jest.fn(),
    } as unknown as CorpusQueryExecutor;
    const repo = new ProductRepository(db);

    await expect(repo.searchBrands('cera')).resolves.toEqual([]);
  });
});
