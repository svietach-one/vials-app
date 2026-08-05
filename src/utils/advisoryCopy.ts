/**
 * Non-absolute language guarantee (PRD v1.2 §4.2.2, US-26).
 *
 * Every condition-derived and density-derived message template lives in a
 * central table (CONDITION_MODIFIERS, RECOVERY_CAUTIONS, DENSITY_MESSAGES,
 * SPF_ADEQUACY_MESSAGE) and is scanned against this list by
 * src/utils/advisoryCopy.test.ts. These layers are advisory: they escalate a
 * caution, they never assert certainty, prohibit anything, or block a save —
 * so prohibitive phrasing here would misrepresent both the evidence and what
 * the app actually does.
 *
 * This is a lint over ADVISORY copy only. The clinical hard blocks (seasonal /
 * spacing warnings) are a different register on purpose and are not scanned.
 */

/** Phrases no advisory template may contain. Matched case-insensitively. */
export const BANNED_ADVISORY_PHRASES: readonly string[] = [
  'cannot',
  "can't",
  'must not',
  'forbidden',
  'prohibited',
  'unsafe',
  'do not use',
  'you should not',
  'never use',
];

/**
 * Returns every banned phrase present in `text`. Empty array = compliant.
 *
 * Word-boundary anchored at the start so "cannot" does not fire on a longer
 * word that merely contains it. EVERY occurrence is checked, not just the
 * first: a leading false positive ("scannot") must never mask a real
 * violation later in the same string — this function is US-26's enforcement
 * point, and a lint that can silently pass is worse than no lint at all.
 */
export function findBannedPhrases(text: string): string[] {
  const haystack = text.toLowerCase();
  return BANNED_ADVISORY_PHRASES.filter((phrase) => {
    for (let index = haystack.indexOf(phrase); index !== -1; index = haystack.indexOf(phrase, index + 1)) {
      const before = index === 0 ? '' : haystack[index - 1];
      if (before === '' || !/[a-z]/.test(before)) return true;
    }
    return false;
  });
}
