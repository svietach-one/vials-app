import activesRuleset from '@/constants/rulesets/actives.json';
import { ActiveIngredientKey } from '@/types';

interface RulesetMatcher {
  pattern: string;
  potency?: string;
}

interface RulesetActiveClass {
  displayName: string;
  matchers: RulesetMatcher[];
  negativePatterns?: string[];
}

interface CompiledMatcher {
  regex: RegExp;
  pattern: string;
  potency?: string;
}

interface CompiledActiveClass {
  key: ActiveIngredientKey;
  matchers: CompiledMatcher[];
  negativePatterns: RegExp[];
}

/**
 * The literal substring a matcher fired on, plus the source pattern that
 * fired it (used as the `aliasOverrides.json` lookup key). Lets the UI show
 * users the exact text the engine acted on instead of just the class label —
 * see docs/specs/inci-attribution-highlighting.md ("Hidden Alias" problem).
 */
export interface MatchedToken {
  rawText: string;
  matcherPattern: string;
}

/** A parsed class hit with the strongest potency among its matched patterns. */
export interface ParsedActiveDetail {
  key: ActiveIngredientKey;
  potency?: string;
  matches: MatchedToken[];
}

const POTENCY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, rx: 3 };

const RULESET_CLASSES = activesRuleset.classes as unknown as Record<
  string,
  RulesetActiveClass
>;

/** Maps pre-ruleset tag keys to their canonical actives.json class keys. */
const LEGACY_KEY_MAP = activesRuleset.legacyKeyMap as Record<
  string,
  ActiveIngredientKey
>;

/**
 * Matchers compiled once at module load. All patterns are case-insensitive;
 * negative patterns are global so every occurrence is stripped before the
 * positive pass (e.g. "retinol-free" must not leave "retinol" behind).
 * Lookbehind is deliberately absent from the ruleset — Hermes support is
 * unreliable — so derivative-vs-parent collisions (e.g. "ethyl ascorbic
 * acid" vs "ascorbic acid") are resolved via negativePatterns instead.
 */
const COMPILED_CLASSES: CompiledActiveClass[] = Object.entries(RULESET_CLASSES).map(
  ([key, cls]) => ({
    key: key as ActiveIngredientKey,
    matchers: cls.matchers.map((m) => ({
      regex: new RegExp(m.pattern, 'i'),
      pattern: m.pattern,
      potency: m.potency,
    })),
    negativePatterns: (cls.negativePatterns ?? []).map((p) => new RegExp(p, 'gi')),
  }),
);

/** Maps a persisted pre-ruleset tag to its canonical class key. */
export function normalizeActiveKey(key: ActiveIngredientKey): ActiveIngredientKey {
  return LEGACY_KEY_MAP[key] ?? key;
}

/** Parses INCI ingredient text and returns matched canonical active class keys. */
export function parseActiveIngredientsFromInci(inciText: string): ActiveIngredientKey[] {
  return parseActiveIngredientDetails(inciText).map((detail) => detail.key);
}

/**
 * Parses INCI ingredient text into class hits with potency. When several
 * matchers of one class match (e.g. retinol AND retinyl palmitate in one
 * formula), the strongest potency wins — safety-first for pair-rule
 * exceptions that downgrade only on low potency.
 */
export function parseActiveIngredientDetails(inciText: string): ParsedActiveDetail[] {
  const found: ParsedActiveDetail[] = [];

  for (const cls of COMPILED_CLASSES) {
    let text = inciText;
    for (const negative of cls.negativePatterns) {
      text = text.replace(negative, ' ');
    }

    let potency: string | undefined;
    const matches: MatchedToken[] = [];
    for (const matcher of cls.matchers) {
      const match = matcher.regex.exec(text);
      if (!match) continue;
      matches.push({ rawText: match[0], matcherPattern: matcher.pattern });
      if (
        matcher.potency !== undefined &&
        (potency === undefined || POTENCY_RANK[matcher.potency] > POTENCY_RANK[potency])
      ) {
        potency = matcher.potency;
      }
    }
    if (matches.length > 0) found.push({ key: cls.key, potency, matches });
  }

  return found;
}

/**
 * Returns canonical active keys from a product's wizard-confirmed tags,
 * parsed ingredient list, and full INCI text. Wizard-confirmed activeTags are
 * authoritative (same contract as buildProductFacts); explicit keys may still
 * carry legacy values from data persisted before the ruleset migration — they
 * are normalized here so every consumer compares in canonical key space.
 */
export function getProductActiveKeys(product: {
  activeIngredients: { key: ActiveIngredientKey }[];
  activeTags?: ActiveIngredientKey[];
  fullIngredientText: string | null;
}): ActiveIngredientKey[] {
  const keys = new Set<ActiveIngredientKey>(
    product.activeIngredients.map((ing) => normalizeActiveKey(ing.key)),
  );

  for (const tag of product.activeTags ?? []) {
    keys.add(normalizeActiveKey(tag));
  }

  if (product.fullIngredientText) {
    for (const key of parseActiveIngredientsFromInci(product.fullIngredientText)) {
      keys.add(key);
    }
  }

  return [...keys];
}
