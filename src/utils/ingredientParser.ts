import activesRuleset from '@/constants/rulesets/actives.json';
import { ActiveIngredientKey } from '@/types';

interface RulesetMatcher {
  pattern: string;
  potency?: string;
}

interface RulesetAttribution {
  requireWithinPosition?: number;
  downgradeToLowAfterPosition?: number;
}

interface RulesetActiveClass {
  displayName: string;
  matchers: RulesetMatcher[];
  negativePatterns?: string[];
  attribution?: RulesetAttribution;
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
  attribution?: RulesetAttribution;
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
  /**
   * 1-based comma-token index of the earliest matcher hit — INCI lists are
   * concentration-ordered above 1%, so position approximates concentration.
   * Always 1 for freeform text without commas (gates then never fire).
   */
  position: number;
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
    attribution: cls.attribution,
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

/** Earliest 1-based comma-token index any of the class's matchers fires on. */
function earliestMatchPosition(tokens: string[], cls: CompiledActiveClass): number | null {
  for (let i = 0; i < tokens.length; i += 1) {
    let token = tokens[i];
    for (const negative of cls.negativePatterns) {
      negative.lastIndex = 0;
      token = token.replace(negative, ' ');
    }
    if (cls.matchers.some((m) => m.regex.test(token))) return i + 1;
  }
  return null;
}

/**
 * Parses INCI ingredient text into class hits with potency. When several
 * matchers of one class match (e.g. retinol AND retinyl palmitate in one
 * formula), the strongest potency wins — safety-first for pair-rule
 * exceptions that downgrade only on low potency.
 *
 * Position-gated attribution (V2.1 phase-03): a class declaring
 * `attribution.requireWithinPosition` only attributes when its earliest hit
 * sits at or before that comma-token position (keeps near-universal bases
 * like glycerin from tagging every product); one declaring
 * `attribution.downgradeToLowAfterPosition` keeps the class but forces
 * evidenced potency to 'low' when the earliest hit is past that position —
 * a trace acid stays visible to safety checks, never dropped.
 */
export function parseActiveIngredientDetails(inciText: string): ParsedActiveDetail[] {
  const found: ParsedActiveDetail[] = [];
  const tokens = inciText.split(',').map((t) => t.trim());

  for (const cls of COMPILED_CLASSES) {
    let text = inciText;
    for (const negative of cls.negativePatterns) {
      negative.lastIndex = 0;
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
    if (matches.length === 0) continue;

    // The whole-text pass above found a hit, so a token-level position always
    // exists; ?? 1 is unreachable-but-safe if the two passes ever diverge.
    const position = earliestMatchPosition(tokens, cls) ?? 1;
    const gates = cls.attribution;
    if (gates?.requireWithinPosition !== undefined && position > gates.requireWithinPosition) {
      continue;
    }
    if (
      gates?.downgradeToLowAfterPosition !== undefined &&
      position > gates.downgradeToLowAfterPosition &&
      potency !== undefined
    ) {
      potency = 'low';
    }

    found.push({ key: cls.key, potency, matches, position });
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
