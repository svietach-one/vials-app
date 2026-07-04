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

interface CompiledActiveClass {
  key: ActiveIngredientKey;
  matchers: RegExp[];
  negativePatterns: RegExp[];
}

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
    matchers: cls.matchers.map((m) => new RegExp(m.pattern, 'i')),
    negativePatterns: (cls.negativePatterns ?? []).map((p) => new RegExp(p, 'gi')),
  }),
);

/** Maps a persisted pre-ruleset tag to its canonical class key. */
export function normalizeActiveKey(key: ActiveIngredientKey): ActiveIngredientKey {
  return LEGACY_KEY_MAP[key] ?? key;
}

/** Parses INCI ingredient text and returns matched canonical active class keys. */
export function parseActiveIngredientsFromInci(inciText: string): ActiveIngredientKey[] {
  const found = new Set<ActiveIngredientKey>();

  for (const cls of COMPILED_CLASSES) {
    let text = inciText;
    for (const negative of cls.negativePatterns) {
      text = text.replace(negative, ' ');
    }
    if (cls.matchers.some((matcher) => matcher.test(text))) {
      found.add(cls.key);
    }
  }

  return [...found];
}

/**
 * Returns canonical active keys from a product's parsed list and full INCI
 * text. Explicit (wizard-confirmed) tags may still carry legacy keys from
 * data persisted before the ruleset migration — they are normalized here so
 * every consumer compares in canonical key space.
 */
export function getProductActiveKeys(product: {
  activeIngredients: { key: ActiveIngredientKey }[];
  fullIngredientText: string | null;
}): ActiveIngredientKey[] {
  const keys = new Set<ActiveIngredientKey>(
    product.activeIngredients.map((ing) => normalizeActiveKey(ing.key)),
  );

  if (product.fullIngredientText) {
    for (const key of parseActiveIngredientsFromInci(product.fullIngredientText)) {
      keys.add(key);
    }
  }

  return [...keys];
}
