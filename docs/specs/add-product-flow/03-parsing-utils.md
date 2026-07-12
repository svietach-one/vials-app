# Task 03: Parsing Utilities (no AI/LLM)

Depends on: `01-types.md`

## Goal

Create three pure, deterministic utility files under
`src/utils/productForm/`. None of these call any network endpoint or AI
model — everything is string matching against static data.

## `categoryDetector.ts`

```ts
const CATEGORY_PATTERNS: Array<[RegExp, ProductType]> = [
  [/\bserum\b/i, 'Serum'],
  [/\bcream|moistur/i, 'Moisturizer'],
  [/\bclean(s|z)er|\bwash\b/i, 'Cleanser'],
  [/\btoner|tonic\b/i, 'Toner'],
  [/\bspf\s?\d+|sunscreen|sun\s?screen/i, 'SPF'],
  [/\bmask\b/i, 'Mask'],
  [/\boil\b/i, 'Oil'],
  [/\bexfoliant|peeling|scrub/i, 'Exfoliant'],
];

function detectCategory(rawOcrText: string): ProductType | null {
  for (const [pattern, type] of CATEGORY_PATTERNS) {
    if (pattern.test(rawOcrText)) return type;
  }
  return null;
}
```
First match wins. If QA finds ambiguous cases (e.g. "sunscreen serum"
matching both SPF and Serum patterns), keep first-match-wins and leave a
code comment — don't over-engineer this, the category pill is always
user-overridable.

## `activeIngredientMatcher.ts`

```ts
const ACTIVE_KEY_LOOKUP: Record<string, ActiveIngredientKey> = {
  'retinol': 'RETI', 'retinal': 'RETI', 'retinaldehyde': 'RETI',
  'tretinoin': 'RETI', 'adapalene': 'RETI', 'retinyl palmitate': 'RETI',
  'glycolic acid': 'ACID', 'salicylic acid': 'ACID', 'lactic acid': 'ACID',
  'mandelic acid': 'ACID', 'malic acid': 'ACID',
  'ascorbic acid': 'VIT_C', 'sodium ascorbyl phosphate': 'VIT_C',
  'magnesium ascorbyl phosphate': 'VIT_C', 'ethyl ascorbic acid': 'VIT_C',
  'copper peptide': 'PEPT', 'palmitoyl tripeptide-1': 'PEPT',
  'palmitoyl pentapeptide-4': 'PEPT', 'acetyl hexapeptide-8': 'PEPT',
};

function parseInciText(rawText: string): ActiveIngredientKey[] {
  const tokens = rawText
    .toLowerCase()
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const found = new Set<ActiveIngredientKey>();
  for (const token of tokens) {
    for (const [name, key] of Object.entries(ACTIVE_KEY_LOOKUP)) {
      if (token.includes(name)) found.add(key);
    }
  }
  return Array.from(found);
}
```
This is `O(tokens × lookupEntries)` — trivially fast for a ~30-ingredient
INCI list. No fuzzy matching here; that's a server-side concern for
product-name search (`pg_trgm`) and out of scope for this client-side
ingredient parse, which only runs on clean Latin INCI text (see
`05-inci-notice.md` for why the input is guaranteed clean).

Keep `ACTIVE_KEY_LOOKUP` as the single canonical client-side map — don't
duplicate it elsewhere in the codebase.

## `brandLookup.ts`

```ts
async function searchBrands(query: string): Promise<string[]>
```
If `expo-sqlite` / the local product database from `db-setup-guide.md` is
already wired up in this codebase, implement this as:
```sql
SELECT DISTINCT brand FROM products WHERE brand LIKE ? || '%' COLLATE NOCASE LIMIT 5
```
If that local database layer isn't wired up yet, fall back to an
in-memory filter over the existing `productsStore` brand set:
```ts
const brands = [...new Set(productsStore.getState().products.map(p => p.brand))];
return brands.filter(b => b.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5);
```
Keep the function signature identical either way (`Promise<string[]>`) so
swapping the implementation later doesn't touch any calling component.
Debounce calls to this at the call site (150ms), not inside this utility.

## `ocrNormalizer.ts`

Reuse the existing planned utility from `db-setup-guide.md` Sprint 4 if it
already exists in the codebase — do not fork a second implementation. Add
one function to it for this flow specifically:

```ts
function splitLabelText(rawText: string): { brand: string; name: string }
```
Heuristic: first line / largest text block = brand, remaining lines =
product name. Strip trademark symbols (`©ⓡ™`), collapse whitespace. Keep
this simple — both fields are always user-editable after the OCR result
lands, so an imperfect split is low-cost to fix and not worth heavy
engineering.

## Done when

- All three files are pure functions (no React Native imports) and
  unit-testable standalone.
- `activeIngredientMatcher.ts` has test cases confirming it does NOT
  match on non-Latin/translated text (should simply return `[]` for
  something like a Polish or Korean ingredient string — this is the
  expected behavior enforced by `05-inci-notice.md`, not a bug to fix
  here).
- `categoryDetector.ts` has at least one test per pattern.
