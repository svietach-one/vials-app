import { ProductRepository } from './ProductRepository';
import { SEARCH_CONFIG } from './searchConfig';
import type { CorpusProduct, CorpusQueryExecutor } from './types';

function makeFakeDb(rows: unknown[] = []) {
  const getAllAsync = jest.fn().mockResolvedValue(rows);
  const getFirstAsync = jest.fn();
  return { db: { getAllAsync, getFirstAsync } as unknown as CorpusQueryExecutor, getAllAsync };
}

function row(overrides: Partial<CorpusProduct> & { ratingCount?: number } = {}): CorpusProduct {
  return {
    uid: 'uid-1',
    barcode: null,
    brand: 'CeraVe',
    name: 'Foaming Facial Cleanser',
    type: 'cleanser',
    inciRaw: null,
    imageUrl: null,
    source: 'obf_import',
    url: null,
    nameLacin: null,
    ...overrides,
  };
}

describe('ProductRepository.search — empty/short-circuit behavior', () => {
  it('returns [] without querying the db when the trimmed query is empty', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    const result = await repo.search({ name: '   ', origin: 'typed' });

    expect(result).toEqual([]);
    expect(getAllAsync).not.toHaveBeenCalled();
  });

  it('returns [] without querying the db for a 1-character typed query', async () => {
    // Acceptance criterion: queries under 2 characters return no list at all.
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    const result = await repo.search({ name: 'a', origin: 'typed' });

    expect(result).toEqual([]);
    expect(getAllAsync).not.toHaveBeenCalled();
  });

  it('does query for a 2-character typed query (the floor is "under 2", not "under 3")', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search({ name: 'ce', origin: 'typed' });

    expect(getAllAsync).toHaveBeenCalled();
  });
});

describe('ProductRepository.search — OCR-origin recall (trigram FTS)', () => {
  it('joins brand and name into a single trigram source for a segmented OCR query', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search({ brand: 'CeraVe', name: 'Foaming Cleanser', origin: 'ocr', raw: 'CeraVe\nFoaming Cleanser' });

    expect(getAllAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('products_fts');
    expect(sql).toContain('bm25');
    // The trigram source is `${brand} ${name}` joined, never the raw multi-line blob:
    // the MATCH param must contain trigrams from both words with no embedded newline.
    const [match] = params;
    expect(match).not.toContain('\n');
    expect(match).toContain('"cer"');
    expect(match).toContain('"foa"');
  });

  it('honors SEARCH_CONFIG.recallLimit, not a hardcoded 20, in the FTS recall query', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search({ name: 'CeraVe Foaming Cleanser', origin: 'ocr' });

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('LIMIT ?');
    expect(params[params.length - 1]).toBe(SEARCH_CONFIG.recallLimit);
  });

  it('falls back to a case-variant search_norm substring scan when the OCR text has no 3-char token', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search({ name: 'ab', origin: 'ocr' });

    expect(getAllAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).not.toContain('products_fts');
    expect(sql).toContain('search_norm LIKE');
    expect(params).toContain('%ab%');
    expect(params).toContain('%AB%');
  });

  it('propagates the error when the underlying query throws, so callers can surface it', async () => {
    const db = {
      getAllAsync: jest.fn().mockRejectedValue(new Error('turso unreachable')),
      getFirstAsync: jest.fn(),
    } as unknown as CorpusQueryExecutor;
    const repo = new ProductRepository(db);

    await expect(repo.search({ name: 'CeraVe Foaming Cleanser', origin: 'ocr' })).rejects.toThrow(
      'turso unreachable',
    );
  });
});

describe('ProductRepository.search — typed-origin recall (word-boundary prefix)', () => {
  it('issues a word-boundary prefix LIKE scan, not the trigram FTS query, for typed origin', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search({ name: 'cerave', origin: 'typed' });

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).not.toContain('products_fts');
    expect(sql).toContain('search_norm LIKE');
    // Prefix-of-whole-string and word-boundary-elsewhere patterns, not a bare substring scan.
    expect(params).toContain('cerave%');
    expect(params).toContain('% cerave%');
    expect(params).not.toContain('%cerave%');
  });

  it('trims the query before building the LIKE params', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search({ name: '  ab  ', origin: 'typed' });

    const [, params] = getAllAsync.mock.calls[0];
    expect(params).toContain('ab%');
    expect(params).not.toContain('  ab  %');
  });

  it('matches Cyrillic queries regardless of the source data letter casing', async () => {
    // Regression guard carried over from step 1: search_norm's non-ASCII
    // characters keep the source data's original casing (SQL lower()
    // doesn't fold Cyrillic), so a 'би' query only matches a row stored as
    // "Биолит ..." if the capitalized variant ('Би') is tried too.
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search({ name: 'би', origin: 'typed' });

    const [, params] = getAllAsync.mock.calls[0];
    expect(params).toContain('Би%');
  });

  it('escapes literal % and _ in the query so they are matched as text, not SQL wildcards', async () => {
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    await repo.search({ name: '50%', origin: 'typed' });

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain("ESCAPE '\\'");
    expect(params).toContain('50\\%%');
  });

  it('supplements a thin prefix-scan result with a fuzzy trigram pass for a >=4-char query', async () => {
    // Name deliberately contains a word starting with the query so the
    // fuzzy-recalled row also clears the score floor regardless of the
    // tuned SEARCH_CONFIG.minMatchScore value (rule 2: prefix match).
    const fuzzyRow = row({ uid: 'fuzzy-1', brand: 'SomeBrand', name: 'Ceravelle Moisturizing Cream' });
    const getAllAsync = jest
      .fn()
      .mockResolvedValueOnce([]) // prefix scan: nothing
      .mockResolvedValueOnce([fuzzyRow]); // fuzzy FTS supplement
    const db = { getAllAsync, getFirstAsync: jest.fn() } as unknown as CorpusQueryExecutor;
    const repo = new ProductRepository(db);

    const results = await repo.search({ name: 'cerav', origin: 'typed' });

    expect(getAllAsync).toHaveBeenCalledTimes(2);
    const [secondSql] = getAllAsync.mock.calls[1];
    expect(secondSql).toContain('products_fts');
    expect(results.map((r) => r.uid)).toEqual(['fuzzy-1']);
  });

  it('does not fetch the fuzzy supplement when the prefix scan already has enough rows', async () => {
    const plenty = Array.from({ length: SEARCH_CONFIG.maxResults }, (_, i) =>
      row({ uid: `u${i}`, name: `Cerave Product ${i}` }),
    );
    const { db, getAllAsync } = makeFakeDb(plenty);
    const repo = new ProductRepository(db);

    await repo.search({ name: 'cerave', origin: 'typed' });

    expect(getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('does not fetch the fuzzy supplement for a query under 4 normalized characters', async () => {
    const { db, getAllAsync } = makeFakeDb([]);
    const repo = new ProductRepository(db);

    await repo.search({ name: 'ce', origin: 'typed' });

    expect(getAllAsync).toHaveBeenCalledTimes(1);
  });
});

describe('ProductRepository.search — scoring and cutoff', () => {
  it('returns [] when every retrieved candidate scores under the floor', async () => {
    const { db } = makeFakeDb([row({ uid: 'u1', brand: 'Weleda', name: 'Baby Calendula Cream' })]);
    const repo = new ProductRepository(db);

    const result = await repo.search({ name: 'xyzxyz totally unrelated', origin: 'typed' });

    expect(result).toEqual([]);
  });

  it('carries a score on every returned result', async () => {
    const { db } = makeFakeDb([row({ uid: 'u1', brand: 'CeraVe', name: 'Foaming Facial Cleanser' })]);
    const repo = new ProductRepository(db);

    const result = await repo.search({ name: 'cerave foaming facial cleanser', origin: 'typed' });

    expect(result).toHaveLength(1);
    expect(typeof result[0].score).toBe('number');
    expect(result[0].score).toBeGreaterThan(0);
  });

  it('returns [] end-to-end for an all-generic query, not just a scoreField sentinel (docs/tasks/ocr_improvement/05-stopwords.md §3)', async () => {
    // "crème pour peaux sensibles" is the step doc's own canonical example:
    // every token is generic cosmetic vocabulary, so there is no
    // identifying signal to rank ANY of these retrieved candidates by —
    // search() must return [] end-to-end, not just have scoreField return
    // the internal GENERIC_ONLY sentinel.
    const { db } = makeFakeDb([
      row({ uid: 'u1', brand: 'Weleda', name: 'Baby Calendula Cream' }),
      row({ uid: 'u2', brand: 'CeraVe', name: 'Moisturizing Cream' }),
    ]);
    const repo = new ProductRepository(db);

    const result = await repo.search({ name: 'crème pour peaux sensibles', origin: 'typed' });

    expect(result).toEqual([]);
  });

  it('caps typed results at SEARCH_CONFIG.maxResults', async () => {
    // Query against the `name` field (typed queries have no separate brand,
    // so scoring only ever looks at candidate.name — see scoreCandidate.ts)
    // so every row scores a full match regardless of the tuned floor.
    const many = Array.from({ length: 20 }, (_, i) => row({ uid: `u${i}`, brand: 'CeraVe', name: `Cleanser ${i}` }));
    const { db } = makeFakeDb(many);
    const repo = new ProductRepository(db);

    const result = await repo.search({ name: 'cleanser', origin: 'typed' });

    expect(result.length).toBeLessThanOrEqual(SEARCH_CONFIG.maxResults);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('ProductRepository.search — typed tier ordering and keystroke stability', () => {
  it('ranks an exact combined match above a same-brand sibling', async () => {
    const { db } = makeFakeDb([
      row({ uid: 'exact', brand: 'CeraVe', name: 'Foaming Facial Cleanser' }),
      row({ uid: 'sibling', brand: 'CeraVe', name: 'Foaming Facial Cleanser Sensitive Skin' }),
    ]);
    const repo = new ProductRepository(db);

    const result = await repo.search({ name: 'cerave foaming facial cleanser', origin: 'typed' });

    expect(result[0].uid).toBe('exact');
  });

  it('narrows rather than reshuffles as the user types one more character', async () => {
    // Same underlying candidate pool both times (a fixed recall stage, as if
    // both queries retrieved the same rows) — only the query text changes.
    // "cleanser" and "cleansing" both start with "cleans" (tier 4 for both,
    // full score for both — the query's one token prefix-matches a word in
    // both names), but only "cleanser" continues to prefix-match once the
    // query grows to "cleanse" (cleansing's 7th letter is "i", not "e") —
    // "cleansing"'s score then drops to exactly 0 (no rule fires: rule 2's
    // prefix check fails, and rule 3's trigram overlap is 0.5, under the
    // 0.6 floor), so it disappears regardless of the tuned SEARCH_CONFIG
    // .minMatchScore value.
    const pool = [
      row({ uid: 'cleanser', brand: 'CeraVe', name: 'Gentle Cleanser' }),
      row({ uid: 'cleansing', brand: 'CeraVe', name: 'Gentle Cleansing Oil' }),
    ];

    const repoFor = (rows: CorpusProduct[]) => {
      const { db } = makeFakeDb(rows);
      return new ProductRepository(db);
    };

    const shortResults = await repoFor(pool).search({ name: 'cleans', origin: 'typed' });
    const longResults = await repoFor(pool).search({ name: 'cleanse', origin: 'typed' });

    expect(shortResults.map((r) => r.uid).sort()).toEqual(['cleanser', 'cleansing']);
    expect(longResults.map((r) => r.uid)).toEqual(['cleanser']);

    // Typing one more character should only narrow the set (every uid still
    // shown after the extra keystroke was already shown before it) — never
    // introduce a uid that wasn't there.
    const shortUids = shortResults.map((r) => r.uid);
    const longUids = longResults.map((r) => r.uid);
    expect(longUids.every((uid) => shortUids.includes(uid))).toBe(true);
  });
});

describe('ProductRepository.search — SEARCH_CONFIG.scoringV2 gate', () => {
  const originalScoringV2 = SEARCH_CONFIG.scoringV2;
  afterEach(() => {
    SEARCH_CONFIG.scoringV2 = originalScoringV2;
  });

  it('reproduces the pre-step-2 unscored, origin-agnostic, LIMIT-20 path when scoringV2 is off', async () => {
    SEARCH_CONFIG.scoringV2 = false;
    const { db, getAllAsync } = makeFakeDb([row({ uid: 'u1' })]);
    const repo = new ProductRepository(db);

    // A 1-char typed query would be blocked by the step-2 minimum-length
    // guard, but that guard is itself part of scoringV2 — with the flag
    // off, the legacy path (which had no such guard) still queries.
    const result = await repo.search({ name: 'a', origin: 'typed' });

    expect(getAllAsync).toHaveBeenCalledTimes(1);
    const [sql] = getAllAsync.mock.calls[0];
    expect(sql).toContain('LIMIT 20');
    expect(result).toHaveLength(1);
  });

  it('runs the new scored/tiered pipeline when scoringV2 is on (the default)', async () => {
    SEARCH_CONFIG.scoringV2 = true;
    const { db, getAllAsync } = makeFakeDb();
    const repo = new ProductRepository(db);

    const result = await repo.search({ name: 'a', origin: 'typed' });

    // Blocked by the 2-char minimum before any db call — proves the new
    // pipeline (not the legacy one) is active.
    expect(result).toEqual([]);
    expect(getAllAsync).not.toHaveBeenCalled();
  });
});

describe('ProductRepository.search — SEARCH_CONFIG.stopwordsEnabled gate (docs/tasks/ocr_improvement/05-stopwords.md)', () => {
  const originalStopwordsEnabled = SEARCH_CONFIG.stopwordsEnabled;
  afterEach(() => {
    SEARCH_CONFIG.stopwordsEnabled = originalStopwordsEnabled;
  });

  it('scores an all-generic query as plain coverage (no GENERIC_ONLY floor) when stopwordsEnabled is false', async () => {
    SEARCH_CONFIG.stopwordsEnabled = false;
    const { db } = makeFakeDb([
      row({ uid: 'u1', brand: 'Some Brand', name: 'Crème Pour Peaux Sensibles Apaisante' }),
    ]);
    const repo = new ProductRepository(db);

    const result = await repo.search({ name: 'crème pour peaux sensibles', origin: 'typed' });

    // Same behaviour as before this step: an exact token-for-token match
    // still scores and returns, since there is no stopword split to reduce
    // it to GENERIC_ONLY.
    expect(result.map((r) => r.uid)).toEqual(['u1']);
  });
});
