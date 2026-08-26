import { GENERIC_ONLY, isShortQuery, scoreCandidate, scoreField, SHORT_QUERY_MIN_SCORE } from './scoreCandidate';
import { SEARCH_CONFIG } from './searchConfig';
import type { CorpusProduct, ProductQuery } from './types';

function candidate(overrides: Partial<CorpusProduct> = {}): CorpusProduct {
  return {
    uid: 'uid-1',
    barcode: null,
    brand: null,
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

describe('scoreField — token matching (docs/tasks/ocr_improvement/03-scoring-and-cutoff.md)', () => {
  it('scores 1.0 for an exact token match after normalizeForMatch (rule 1)', () => {
    expect(scoreField('Avène Eau Thermale', 'avene eau thermale')).toBe(1);
  });

  it('scores a longer document without penalty for its extra tokens (asymmetric containment, the "The Ordinary" case)', () => {
    const score = scoreField(
      'the ordinary niacinamide',
      'The Ordinary Niacinamide 10% + Zinc 1% Serum',
    );
    // Every query token is covered by the document; the document's extra
    // tokens (10%, zinc, 1%, serum) must not drag the score down — that is
    // the whole point of coverage-of-query-by-document over symmetric Jaccard.
    expect(score).toBe(1);
  });

  it('tolerates an OCR-style typo via the trigram fuzzy rule (rule 3, tokens >=5 chars)', () => {
    // "0rdinary" (OCR zero-for-O) vs "ordinary" — both >=5 chars, high trigram overlap.
    const score = scoreField('the 0rdinary niacinamide', 'the ordinary niacinamide');
    expect(score).toBe(1);
  });

  it('does not let rule 3 fire on short tokens (both must be >=5 chars)', () => {
    // "wax" vs "wat" is a 1-letter edit on 3-char tokens — exactly the kind
    // of coincidental short-token overlap the step doc says must NOT match
    // ("a large part of how the current implementation ends up matching a
    // wax to a cream").
    expect(scoreField('wax', 'wat')).toBe(0);
    // Sanity: trigram similarity between "wax"/"wat" would otherwise be high
    // enough to pass the 0.6 fuzzy threshold if rule 3 applied to short tokens.
  });

  it('does not match on coincidental letter overlap between different brands (wrong-brand-similar-letters)', () => {
    // "Avene" vs "Aveeno" share a prefix but are different, real brands —
    // neither exact, nor a qualifying prefix (docToken doesn't start with
    // the query token), nor similar enough by trigram (both just clear 5
    // chars, but overlap is low).
    const score = scoreField('avene', 'aveeno moisturizing cream');
    expect(score).toBe(0);
  });

  it('scores 0 when the query has no tokens', () => {
    expect(scoreField('   ', 'anything')).toBe(0);
  });

  it('scores 0 when the document has no tokens', () => {
    expect(scoreField('cerave', '   ')).toBe(0);
  });

  describe('short-query guard (strict mode)', () => {
    it('matches a 2-character query as a bare prefix, without the normal >=4-char restriction', () => {
      // Rule 2 normally requires the query token to be >=4 chars; strict
      // mode drops that restriction — that relaxation is "the whole point"
      // of the short-query guard per the step doc.
      expect(scoreField('ce', 'cerave', { strict: true })).toBe(1);
    });

    it('does not fuzzy-match in strict mode even for two long, similar tokens', () => {
      // Outside strict mode this would hit rule 3; strict mode skips rule 3 entirely.
      expect(scoreField('0rdinary', 'ordinary', { strict: true })).toBe(0);
    });
  });
});

describe('isShortQuery', () => {
  it('is true for a normalized combined query under 4 characters (2-character query)', () => {
    const query: ProductQuery = { name: 'ce', origin: 'typed' };
    expect(isShortQuery(query)).toBe(true);
  });

  it('is false once the combined normalized query reaches 4 characters', () => {
    const query: ProductQuery = { name: 'cera', origin: 'typed' };
    expect(isShortQuery(query)).toBe(false);
  });

  it('considers brand + name combined for OCR queries', () => {
    const query: ProductQuery = { brand: 'C', name: 'V', origin: 'ocr' };
    expect(isShortQuery(query)).toBe(true);
  });
});

describe('scoreCandidate — combining brand and name', () => {
  it('scores on name alone when the query has no brand (typed search)', () => {
    const query: ProductQuery = { name: 'foaming facial cleanser', origin: 'typed' };
    const score = scoreCandidate(query, candidate({ brand: 'CeraVe', name: 'Foaming Facial Cleanser' }));
    expect(score).toBe(1);
  });

  it('blends brand (0.35) and name (0.65) when the query has a segmented brand (OCR)', () => {
    const query: ProductQuery = { brand: 'CeraVe', name: 'Foaming Facial Cleanser', origin: 'ocr' };
    const perfect = candidate({ brand: 'CeraVe', name: 'Foaming Facial Cleanser' });
    expect(scoreCandidate(query, perfect)).toBeCloseTo(1);

    // Right name, unrelated brand: name score 1.0, brand score 0 -> 0.65 blend.
    const wrongBrand = candidate({ brand: 'Neutrogena', name: 'Foaming Facial Cleanser' });
    expect(scoreCandidate(query, wrongBrand)).toBeCloseTo(0.65);
  });

  it('applies the short-query guard floor scenario: a 2-char query needs >=0.8, not the default floor', () => {
    // This documents the constant the repository reads for the cutoff —
    // the guard's matching-mode behavior itself is covered by scoreField's
    // "short-query guard" tests above.
    expect(SHORT_QUERY_MIN_SCORE).toBe(0.8);
  });

  // Regression coverage for the human-approved follow-up fix to the gap
  // step 2's own report flagged (progress/ocr-improvement.md dated follow-up
  // entry): a brand-only typed query (no query.brand set — typed search
  // never segments one) must still score meaningfully against a candidate
  // whose `name` field does NOT repeat the brand word, by matching against
  // candidate.brand + ' ' + candidate.name combined instead of name alone.
  it('scores a brand-only typed query against candidate.brand + name combined, not name alone', () => {
    const query: ProductQuery = { name: 'avene', origin: 'typed' };
    const noBrandRepeatInName = candidate({
      brand: 'Avène',
      name: 'Cicalfate+ Restorative Protective Cream',
    });
    // Under the old name-only branch this scored 0 ("avene" appears nowhere
    // in the name field) and would be filtered by minMatchScore, returning
    // no results for a pure brand search.
    expect(scoreCandidate(query, noBrandRepeatInName)).toBeGreaterThan(0);
  });

  it('still scores 0 for a brand-only typed query against an unrelated brand/name (no false positive introduced)', () => {
    const query: ProductQuery = { name: 'avene', origin: 'typed' };
    const unrelated = candidate({ brand: 'Neutrogena', name: 'Hydro Boost Water Gel' });
    expect(scoreCandidate(query, unrelated)).toBe(0);
  });
});

describe('scoreField — stopword-aware token weighting (docs/tasks/ocr_improvement/05-stopwords.md)', () => {
  it('down-weights generic cosmetic vocabulary instead of dropping it (0.85 content / 0.15 generic)', () => {
    // "crème" is a stopword, "niacinamide" is not. The 15% generic weight
    // still counts, so a doc missing the generic word (but matching the
    // content word) scores lower than one matching both, not zero either way.
    const bothMatch = scoreField('crème niacinamide', 'Crème Niacinamide Serum');
    const contentOnlyMatches = scoreField('crème niacinamide', 'Niacinamide Serum');
    expect(bothMatch).toBeCloseTo(1);
    expect(contentOnlyMatches).toBeCloseTo(0.85);
  });

  it('renormalizes to contentCoverage alone (not capped at 0.85) when the query has no generic tokens at all', () => {
    // A fully-specific query must still be able to reach 1.0 -- otherwise
    // SEARCH_CONFIG.minMatchScore silently becomes a stricter floor for
    // every specific query than the step-2 sweep accounted for.
    expect(scoreField('niacinamide', 'The Ordinary Niacinamide 10% + Zinc 1%')).toBe(1);
  });

  it('returns the GENERIC_ONLY sentinel when every query token is a stopword, unless the query is an exact full-name match', () => {
    // "crème pour peaux sensibles" (05-stopwords.md's own canonical example)
    // -- every token is generic cosmetic vocabulary, no content survives.
    expect(scoreField('crème pour peaux sensibles', 'Unrelated Product Name')).toBe(GENERIC_ONLY);
    // Exact-full-name exception (§3, last paragraph): a product literally
    // named just a generic word must still be findable.
    expect(scoreField('Crème', 'Crème')).toBe(1);
  });

  it('lets a shared generic word discriminate between two otherwise content-tied queries ("crème mains" outranks "crème visage" for a hand-cream target)', () => {
    // "mains" and "visage" are both body-area stopwords; "cicalfate" is the
    // real (non-generic) anchor shared by both queries, so contentCoverage
    // ties at 1.0 for both -- the outcome is decided entirely by the 0.15
    // generic weight, exactly the mechanism 05-stopwords.md §2 describes
    // ("blind stripping loses that").
    const handCreamDoc = 'Crème Mains Cicalfate Réparatrice';
    const handsQuery = scoreField('crème mains cicalfate', handCreamDoc);
    const faceQuery = scoreField('crème visage cicalfate', handCreamDoc);
    expect(handsQuery).toBeGreaterThan(faceQuery);
    expect(handsQuery).toBeCloseTo(1);
    expect(faceQuery).toBeCloseTo(0.925);
  });

  it('behaves exactly as plain coverage (no stopword split) when SEARCH_CONFIG.stopwordsEnabled is false', () => {
    const original = SEARCH_CONFIG.stopwordsEnabled;
    SEARCH_CONFIG.stopwordsEnabled = false;
    try {
      // With stopwords off, "crème pour peaux sensibles" is scored token-for-
      // token like any other query -- no GENERIC_ONLY sentinel, no down-weight.
      expect(scoreField('crème pour peaux sensibles', 'Crème Pour Peaux Sensibles Apaisante')).toBe(1);
      expect(scoreField('crème pour peaux sensibles', 'Unrelated Product Name')).toBe(0);
    } finally {
      SEARCH_CONFIG.stopwordsEnabled = original;
    }
  });
});

describe('scoreCandidate — the all-generic query rule (docs/tasks/ocr_improvement/05-stopwords.md §3)', () => {
  it('falls back to the remaining field when only one field is all-generic (brand "Avène" + generic name "crème" still scores)', () => {
    const query: ProductQuery = { brand: 'Avène', name: 'Crème', origin: 'ocr' };
    const c = candidate({ brand: 'Avène', name: 'Cicalfate+ Restorative Protective Cream' });
    // Falls back to the brand field alone (a real, if weak, match) rather
    // than zeroing the candidate or diluting it through the 0.35/0.65 blend
    // against a sentinel that was never a real score.
    expect(scoreCandidate(query, c)).toBe(1);
  });

  it('returns 0 when every field of a segmented (brand-carrying) query is all-generic', () => {
    const query: ProductQuery = { brand: 'Soin', name: 'Crème', origin: 'ocr' };
    const c = candidate({ brand: 'Avène', name: 'Cicalfate+ Restorative Protective Cream' });
    expect(scoreCandidate(query, c)).toBe(0);
  });

  it('returns 0 for an all-generic typed query (no query.brand -- there is no second field to fall back to)', () => {
    // Design decision (see progress/ocr-improvement.md's step-4 log entry):
    // 05-stopwords.md's §3 fallback assumes two always-present fields, which
    // predates the brand-only-fix collapsing !query.brand to one combined
    // field. An all-generic query.name in that branch has nothing left to
    // widen to, so it follows the doc's own top-level "every field
    // GENERIC_ONLY -> 0" rule instead.
    const query: ProductQuery = { name: 'crème pour peaux sensibles', origin: 'typed' };
    const c = candidate({ brand: 'CeraVe', name: 'Moisturizing Cream' });
    expect(scoreCandidate(query, c)).toBe(0);
  });

  it('is still findable when the whole query exactly equals a full product name, even if every token is generic ("Crème de la Mer")', () => {
    const query: ProductQuery = { name: 'Crème de la Mer', origin: 'typed' };
    const c = candidate({ brand: null, name: 'Crème de la Mer' });
    // "crème" is generic, but "de"/"la"/"mer" are real content tokens (not
    // stopwords), so this clears the floor through ordinary scoring --
    // demonstrating the product is findable without even needing the
    // exact-full-name sentinel exception (covered directly on scoreField
    // above), which is the more realistic, robust outcome.
    expect(scoreCandidate(query, c)).toBeCloseTo(1);
  });
});
