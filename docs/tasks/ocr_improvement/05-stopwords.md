# Step 4 — Down-weight generic cosmetic vocabulary

**Prerequisite:** read `00-README.md`, and steps 0–2 must be done (step 3 is independent of this).
Read no other step file.
**Schema changes: none. Risk: low.**

---

## The defect

`src/services/corpus/trigramSearch.ts:13-19` — `toTrigrams()` indexes every token uniformly.
Nothing in the product-search path strips or down-weights generic cosmetic vocabulary.

Words like *crème*, *soin*, *dermatologique*, *peaux sensibles*, *visage*, *corps* appear on
thousands of unrelated products. Under character-level scoring they contribute exactly as much
signal as *cicalfate* or *niacinamide*. This is the direct mechanism behind the reported symptom:
a depilatory wax, a hand cream and a soap sharing "crème / peaux sensibles / dermatologique" score
alongside each other.

`isCommonTerm()` and `LATIN_COMMON_TERMS` already exist in `brandCorrection.ts` for the OCR chip
feature — the vocabulary shape to build from is in the repo, just never consulted by the search.

---

## Where this belongs: the scorer, not the query builder

Do **not** strip stopwords from the FTS trigram query. The trigram query is the *recall* stage —
removing terms there loses candidates you can never get back.

Apply stopword handling in `scoreCandidate.ts` (step 2), which is the *precision* stage. There you
can down-weight rather than delete, and nothing is irrecoverable.

---

## What to change

### 1. The list

```ts
// src/services/corpus/stopwords.ts
export const COSMETIC_STOPWORDS = new Set([ /* ... */ ]);
```

Cover the languages actually present in the corpus (French-heavy, plus English, Polish, Russian).
Roughly 40–80 entries, reviewed by hand, seeded from `LATIN_COMMON_TERMS`. Categories:

- product-form words: crème, cream, gel, lotion, sérum, serum, huile, oil, baume, balm, mousse,
  masque, mask, krem, żel, крем
- body-area words: visage, corps, mains, yeux, face, body, hands, eyes
- claim words: hydratant, hydrating, nourrissant, apaisant, soothing, dermatologique,
  dermatological, sensible, sensitive, peaux, skin
- filler: pour, avec, and, the, für, dla

Store them **normalized** with `normalizeForMatch` so accented and unaccented forms both hit.

Keep the list small and reviewed. Over-stripping is the real risk — *"Crème de la Mer"* and
*"Eight Hour Cream"* are product names where the generic word is load-bearing. Which is exactly why
this is a weight, not a delete.

### 2. Scoring rule — change `scoreField` ONLY

Step 2 created `scoreCandidate.ts` with two exported functions:

```ts
scoreField(queryText, docText): number      // coverage of query tokens by doc tokens, 0..1
scoreCandidate(query, candidate): number    // blends brand/name field scores (0.35 / 0.65)
```

**Modify `scoreField`. Leave `scoreCandidate` and its 0.35/0.65 brand/name blend untouched.**
The two weightings operate at different levels and must not be conflated: brand-vs-name is a
field-level blend, content-vs-generic is a token-level one inside a single field.

Inside `scoreField`, split the *query* tokens:

```ts
function scoreField(queryText, docText) {
  const q = tokenize(normalizeForMatch(queryText));
  const d = tokenize(normalizeForMatch(docText));

  const content = q.filter(t => !COSMETIC_STOPWORDS.has(t));
  const generic = q.filter(t =>  COSMETIC_STOPWORDS.has(t));

  if (content.length === 0) return GENERIC_ONLY;          // sentinel, see below

  return 0.85 * coverage(content, d) + 0.15 * coverage(generic, d);
}
```

where `coverage(queryTokens, docTokens)` is the existing token-matching logic from step 2, extracted
into a helper if it isn't already. Generic tokens keep a small weight so *"crème mains"* can still
outrank *"crème visage"* when nothing else distinguishes them — blind stripping loses that.

If `generic.length === 0`, the second term is 0 by definition of coverage over an empty set; make
sure the implementation returns `0.85 * contentCoverage` rather than dividing by zero. Consider
renormalizing to `contentCoverage` in that case so a query with no generic words can still reach
1.0 — otherwise a perfect match caps at 0.85 and the step 2 threshold silently tightens for every
specific query, which is the opposite of the intent. **Renormalize; then re-run the sweep from
step 2 to confirm `minMatchScore` is still correctly placed.**

### 3. The all-generic query rule

`GENERIC_ONLY` is the case where a field's query text consists entirely of stopwords
(*"crème pour peaux sensibles"*). There is no information there that can identify one product out
of 17,000.

Handle it in `scoreCandidate`, not in `scoreField`'s caller chain: if **every** field of the query
returns `GENERIC_ONLY`, `scoreCandidate` returns 0, nothing clears the floor, and `search()`
returns `[]`. The existing "add manually" flow handles it correctly — do not add new UI.

If only *one* field is all-generic (a generic product name under a real brand, e.g. brand "Avène"
+ name "crème"), do not zero the whole candidate — fall back to scoring on the remaining field.
That is a legitimate, if weak, query.

This rule resolves the exact case in the `generic` / `not_in_corpus` fixtures and is the clearest
demonstration that the cutoff from step 2 is working.

Exception: if the *whole* normalized query exactly equals a full product name in the corpus, allow
it. Rare, but *"Eight Hour Cream"* should not be unfindable because of a stopword list.

---

## Acceptance criteria

- [ ] Stopword list is normalized, hand-reviewed, and covers fr/en/pl/ru forms
- [ ] Only `scoreField` changed; `scoreCandidate`'s 0.35/0.65 blend is untouched
- [ ] Stopwords affect scoring only — the FTS recall query is unchanged
- [ ] Behind `SEARCH_CONFIG.stopwordsEnabled`
- [ ] Renormalization handled, and `minMatchScore` re-swept afterwards
- [ ] Unit tests: all-generic query returns `[]`; brand + generic name still scores;
      *"Crème de la Mer"* is still findable; *"crème mains"* outranks *"crème visage"* for a
      hand-cream target
- [ ] Harness: `false_top_1` drops; `recall@retrieval` unchanged (this step touches scoring only);
      `no_match_rate` on real-match fixtures does not rise. A rise there means the list is too
      aggressive — shrink it rather than lowering the score weight.

---

## Report back

The final list, before/after metrics, and specifically any fixture that regressed — those are the
product names where a generic word was load-bearing, and they should be added to the test suite
permanently.
