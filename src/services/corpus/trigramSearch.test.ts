import { toTrigrams, toTrigramQuery, trigramJaccard } from '@/services/corpus/trigramSearch';

describe('toTrigramQuery', () => {
  it('decomposes a single token into overlapping 3-char grams', () => {
    expect(toTrigramQuery('niacinamide')).toBe(
      ['nia', 'iac', 'aci', 'cin', 'ina', 'nam', 'ami', 'mid', 'ide']
        .map((g) => `"${g}"`)
        .join(' OR '),
    );
  });

  it('tolerates OCR noise by matching on shared substrings', () => {
    const query = toTrigramQuery('the 0rdinary');
    // "rdi" is common to both "0rdinary" and the correctly-spelled "ordinary"
    expect(query).toContain('"rdi"');
  });

  it('splits on non-alphanumeric separators and lowercases input', () => {
    const query = toTrigramQuery('LA ROCHE-POSAY');
    expect(query).toContain('"roc"');
    expect(query).toContain('"che"');
  });

  it('returns an empty string when every token is shorter than 3 chars', () => {
    expect(toTrigramQuery('a b')).toBe('');
  });

  it('deduplicates repeated grams across tokens', () => {
    const query = toTrigramQuery('aaa aaa');
    expect(query).toBe('"aaa"');
  });

  it('decomposes Cyrillic input into overlapping 3-char grams', () => {
    const query = toTrigramQuery('Кремобаза');
    expect(query).toContain('"кре"');
    expect(query).toContain('"баз"');
  });
});

describe('trigramJaccard', () => {
  it('returns 1 for identical trigram sets regardless of case', () => {
    expect(trigramJaccard(toTrigrams('Bioderma'), toTrigrams('BIODERMA'))).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    expect(trigramJaccard(toTrigrams('abcde'), toTrigrams('vwxyz'))).toBe(0);
  });

  it('returns 0 when either set is empty', () => {
    expect(trigramJaccard(new Set(), toTrigrams('bioderma'))).toBe(0);
    expect(trigramJaccard(toTrigrams('bioderma'), new Set())).toBe(0);
  });

  it('computes intersection over union for partial overlap', () => {
    // biodermo: bio iod ode der erm rmo / bioderma: bio iod ode der erm rma
    // → 5 shared of 7 total.
    expect(trigramJaccard(toTrigrams('biodermo'), toTrigrams('bioderma'))).toBeCloseTo(5 / 7);
  });
});
