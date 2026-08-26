import { normalizeForMatch } from '@/utils/textNormalize';
import { LATIN_COMMON_TERMS } from '@/utils/productForm/brandDictionary';

/**
 * Generic cosmetic vocabulary (docs/tasks/ocr_improvement/05-stopwords.md).
 * Words like "crème"/"soin"/"dermatologique"/"peaux sensibles" appear on
 * thousands of unrelated products and contribute no identifying signal in
 * `scoreField` (scoreCandidate.ts) — this module is the reviewed word list
 * that lets `scoreField` down-weight (never delete) them.
 *
 * Stored as normalized, single-word tokens (via {@link normalizeForMatch}, so
 * accented and unaccented OCR/typed forms both hit) because `scoreField`
 * filters QUERY TOKENS one word at a time after tokenizing — a multi-word
 * seed entry ("Eau Tonique", "Écran Solaire") is meaningless as a Set key and
 * must be split into its component words first.
 *
 * Reuse, not reinvention (00-README.md "Reuse, don't reinvent" +
 * 05-stopwords.md's own pointer): seeded from `LATIN_COMMON_TERMS`
 * (brandDictionary.ts), the existing vocabulary for the OCR "did you mean
 * [Brand]?" chip feature, flattened the same way `isCommonTerm()` in
 * brandCorrection.ts does (`Object.values(LATIN_COMMON_TERMS).flat()`).
 * `LATIN_NAME_TERMS` is deliberately NOT reused here — it holds botanicals/
 * actives (Aloe, Argan, Ginseng, ...) that are genuine product-name content,
 * the opposite of generic noise.
 */

/**
 * Fragments dropped from the flattened seed before building the final list.
 * Two kinds:
 *  1. Multi-word seed entries ("Eau Tonique", "Krem przeciwsłoneczny") split
 *     on whitespace/hyphen produce a few standalone fragments that are too
 *     broad on their own ("eau" = plain "water", "solaire"/"soleil" = "sun")
 *     or belong to a category we deliberately keep OUT of this list (see 2).
 *  2. Seed entries that name a specific product CATEGORY or FUNCTION rather
 *     than an interchangeable texture/format word. The step doc's own
 *     product-form examples (crème, cream, gel, lotion, sérum, huile, oil,
 *     baume, balm, mousse, masque, mask, krem, żel, крем) are all pure
 *     texture/format descriptors — a "gel" or "crème" says nothing about
 *     what the product DOES, so it really does appear identically on
 *     thousands of unrelated products (the doc's own test for inclusion).
 *     Ampoule/Booster/Concentrate/Elixir/Essence/Démaquillant/Exfoliant/
 *     Peeling/Scrub/Gommage/Sunscreen/Sunblock/Treatment/Fluid/Mist AND
 *     Cleanser/Wash/Toner/Tonic/Moisturizer/Hydrator/Milk/Butter/Emulsion/
 *     Soin/Spray all name a specific function or category instead (a
 *     cleanser vs. a toner vs. a moisturizer are meaningfully different
 *     searches) — stripping them lost real signal in practice: an earlier
 *     draft of this list included "cleanser," and a plain "cleanser" typed
 *     query stopped returning any candidates at all (every retrieved
 *     candidate's name field went all-generic and fell to
 *     scoreCandidate's !query.brand → 0 branch), a category-browse query
 *     that should legitimately return results. See
 *     progress/ocr-improvement.md's step-4 log entry for the full story —
 *     this is exactly the doc's own guidance in practice ("A rise
 *     [in no_match_rate on real matches] means the list is too aggressive —
 *     shrink it").
 */
const EXCLUDED_SEED_FRAGMENTS = new Set(
  [
    'eau',
    'lavant',
    'ecran',
    'solaire',
    'apres',
    'soleil',
    'myjący',
    'ampoule',
    'ampułka',
    'booster',
    'concentrate',
    'concentré',
    'koncentrat',
    'elixir',
    'eliksir',
    'essence',
    'esencja',
    'démaquillant',
    'exfoliant',
    'peeling',
    'scrub',
    'gommage',
    'sunscreen',
    'sunblock',
    'treatment',
    'fluid',
    'fluide',
    'mist',
    'brume',
    'oczyszczający',
    'złuszczający',
    'przeciwsłoneczny',
    'cleanser',
    'wash',
    'nettoyant',
    'toner',
    'tonic',
    'tonique',
    'tonik',
    'moisturizer',
    'hydrator',
    'milk',
    'lait',
    'mleczko',
    'молочко',
    'butter',
    'beurre',
    'masło',
    'emulsion',
    'emulsja',
    'эмульсия',
    'soin',
    'spray',
  ].map(normalizeForMatch),
);

/** Flattened, split, normalized, curated product-form vocabulary from the seed dictionary. */
const SEED_WORDS: string[] = Object.values(LATIN_COMMON_TERMS)
  .flat()
  .flatMap((term) => term.split(/[\s-]+/))
  .map(normalizeForMatch)
  .filter((w) => w.length > 0 && !EXCLUDED_SEED_FRAGMENTS.has(w));

/**
 * Hand-reviewed additions beyond the seed (05-stopwords.md §1 categories):
 * body-area and claim/descriptor words in the languages the seed dictionary
 * doesn't cover for these categories, plus filler words, plus a Russian
 * product-form set — `LATIN_COMMON_TERMS` has no Russian pool at all, and the
 * corpus has real Cyrillic products (see the `cyrillic`-tagged eval
 * fixtures).
 */
const HAND_ADDED_WORDS: string[] = [
  // body-area words (fr/en/pl/ru)
  'visage', 'corps', 'mains', 'yeux',
  'face', 'body', 'hands', 'eyes',
  'twarz', 'ciało', 'ręce', 'oczy',
  'лицо', 'тело', 'руки', 'глаза',

  // claim / descriptor words (fr/en/pl/ru)
  'hydratant', 'hydrating', 'nourrissant', 'apaisant', 'soothing',
  'dermatologique', 'dermatological', 'sensible', 'sensibles', 'peaux', 'peau', 'skin',
  'kojący', 'kojąca', 'wrażliwy', 'wrażliwa', 'skóra', 'dermatologiczny',
  'увлажняющий', 'увлажняющая', 'успокаивающий', 'успокаивающая', 'чувствительная',
  'кожа', 'дерматологический',

  // filler words (fr/en/pl/de). "et" (French "and") was found missing during
  // the harness re-sweep below: without it, an OCR label like "Visage et
  // corps" left "et" as the field's only "content" token (since it isn't a
  // stopword), so content.length > 0 kept the field OUT of the all-generic
  // rule entirely, letting purely-generic label captures (c042, c048 in
  // label-captures.json) surface a spurious match instead of correctly
  // returning no_match — see progress/ocr-improvement.md's step-4 log entry.
  'pour', 'avec', 'et', 'and', 'the', 'für', 'dla',

  // product-form (ru) -- LATIN_COMMON_TERMS has no Russian pool. Limited to
  // the same pure texture/format concepts kept for fr/en/pl above (see
  // EXCLUDED_SEED_FRAGMENTS's comment for why tonic/milk/emulsion/etc. are
  // deliberately left out).
  'крем', 'гель', 'сыворотка', 'лосьон', 'масло', 'пенка', 'маска', 'бальзам',
];

/**
 * The reviewed stopword list, normalized. ~78 entries across fr/en/pl/ru —
 * within the step doc's "roughly 40-80" estimate. Reached in two passes (see
 * progress/ocr-improvement.md's step-4 log entry for the full story): the
 * first pass took the full flattened `LATIN_COMMON_TERMS` seed (fr+en+pl,
 * ~90 raw entries before even adding Russian) almost unfiltered and landed
 * at ~125 entries; a real regression surfaced during testing (a plain
 * "cleanser" typed query started returning zero results) traced back to
 * category/function words like "cleanser" being treated as pure noise the
 * same as texture words like "crème"/"gel". The list was then re-curated
 * down to the doc's own actual criterion — pure texture/format words that
 * carry no identifying signal — landing in-range without needing to
 * sacrifice the required fr/en/pl/ru coverage.
 */
export const COSMETIC_STOPWORDS: Set<string> = new Set(
  [...SEED_WORDS, ...HAND_ADDED_WORDS.map(normalizeForMatch)].filter((w) => w.length > 0),
);
