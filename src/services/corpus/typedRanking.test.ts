import { classifyTypedTier, compareTypedCandidates, type TypedRankable } from './typedRanking';
import type { CorpusProduct, ProductQuery } from './types';

function candidate(overrides: Partial<CorpusProduct> = {}): CorpusProduct {
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

describe('classifyTypedTier — ranking tiers for typed queries', () => {
  it('tier 1: exact match on the normalized combined "brand name"', () => {
    const query: ProductQuery = { name: 'cerave foaming facial cleanser', origin: 'typed' };
    expect(classifyTypedTier(query, candidate())).toBe(1);
  });

  it('tier 1: exact match on name alone (candidate has no brand)', () => {
    const query: ProductQuery = { name: 'gentle cleansing water', origin: 'typed' };
    expect(classifyTypedTier(query, candidate({ brand: null, name: 'Gentle Cleansing Water' }))).toBe(1);
  });

  it('tier 2: brand starts with the query', () => {
    const query: ProductQuery = { name: 'cera', origin: 'typed' };
    expect(classifyTypedTier(query, candidate({ brand: 'CeraVe', name: 'Renewing SA Cleanser' }))).toBe(2);
  });

  it('tier 3: name starts with the query', () => {
    const query: ProductQuery = { name: 'foaming', origin: 'typed' };
    expect(classifyTypedTier(query, candidate({ brand: 'Neutrogena', name: 'Foaming Facial Cleanser' }))).toBe(3);
  });

  it('tier 4: a word inside the name starts with the query (not the first word)', () => {
    const query: ProductQuery = { name: 'facial', origin: 'typed' };
    expect(classifyTypedTier(query, candidate({ brand: 'Neutrogena', name: 'Foaming Facial Cleanser' }))).toBe(4);
  });

  it('tier 5: no exact/prefix match at all (the fuzzy supplement)', () => {
    const query: ProductQuery = { name: 'moisturizer', origin: 'typed' };
    expect(classifyTypedTier(query, candidate({ brand: 'CeraVe', name: 'Foaming Facial Cleanser' }))).toBe(5);
  });
});

describe('compareTypedCandidates — sort order and deterministic tiebreak', () => {
  it('sorts a lower tier number ahead of a higher one, regardless of score', () => {
    const query: ProductQuery = { name: 'cerave foaming facial cleanser', origin: 'typed' };
    const tier1: TypedRankable = { ...candidate({ uid: 'tier1' }), score: 0.5 };
    const tier5: TypedRankable = {
      ...candidate({ uid: 'tier5', brand: 'Other', name: 'Unrelated Product' }),
      score: 0.99,
    };
    const sorted = [tier5, tier1].sort(compareTypedCandidates(query));
    expect(sorted.map((c) => c.uid)).toEqual(['tier1', 'tier5']);
  });

  it('within the same tier, sorts by score descending', () => {
    const query: ProductQuery = { name: 'foaming', origin: 'typed' };
    const higher: TypedRankable = {
      ...candidate({ uid: 'higher', brand: 'CeraVe', name: 'Foaming Facial Cleanser' }),
      score: 0.9,
    };
    const lower: TypedRankable = {
      ...candidate({ uid: 'lower', brand: 'CeraVe', name: 'Foaming Body Wash' }),
      score: 0.5,
    };
    const sorted = [lower, higher].sort(compareTypedCandidates(query));
    expect(sorted.map((c) => c.uid)).toEqual(['higher', 'lower']);
  });

  it('breaks a same-tier, same-score tie with rating_count DESC', () => {
    const query: ProductQuery = { name: 'foaming', origin: 'typed' };
    const popular: TypedRankable = {
      ...candidate({ uid: 'popular', name: 'Foaming Cleanser' }),
      score: 1,
      ratingCount: 500,
    };
    const obscure: TypedRankable = {
      ...candidate({ uid: 'obscure', name: 'Foaming Wash' }),
      score: 1,
      ratingCount: 3,
    };
    const sorted = [obscure, popular].sort(compareTypedCandidates(query));
    expect(sorted.map((c) => c.uid)).toEqual(['popular', 'obscure']);
  });

  it('breaks a same-tier, same-score, same-rating_count tie with name ASC (stability between keystrokes)', () => {
    const query: ProductQuery = { name: 'foaming', origin: 'typed' };
    // "Foaming Body Wash" < "Foaming Cleanser" alphabetically (B < C).
    const a: TypedRankable = { ...candidate({ uid: 'a', name: 'Foaming Body Wash' }), score: 1, ratingCount: 0 };
    const b: TypedRankable = { ...candidate({ uid: 'b', name: 'Foaming Cleanser' }), score: 1, ratingCount: 0 };
    const sorted = [b, a].sort(compareTypedCandidates(query));
    expect(sorted.map((c) => c.uid)).toEqual(['a', 'b']);
  });
});
