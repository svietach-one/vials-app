import { toTrigramQuery } from '@/services/corpus/trigramSearch';

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
});
