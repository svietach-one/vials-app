/**
 * Product Profile builder — Stage 1: Resolution / Normalization.
 * docs/tasks/product_profile/02-profile-builder.md §4.
 *
 * Reuses `ingredientParser.ts` as-is for the raw-INCI path (no new parsing
 * logic — the parser already performs the text-to-activeKey matching this
 * stage needs). The pre-resolved corpus path skips parsing and just
 * normalizes each key through the same `legacyKeyMap`/`normalizeActiveKey`
 * every entry point uses, so both paths converge on an identical shape
 * before stage 2 (join.ts).
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */
import { DEFAULT_TAG_POTENCY } from '@/constants/rulesets/productFacts';
import { ACTIVES_RULESET, type Potency } from '@/constants/rulesets/rulesetTypes';
import type { ActiveIngredientKey, Product } from '@/types';
import { normalizeActiveKey, parseActiveIngredientDetails } from '@/utils/ingredientParser';

/** Output of stage 1 — the shared shape both entry points converge on. */
export interface ResolvedIngredients {
  /** Sorted, deduped, known-class-only active keys. */
  resolvedActiveKeys: ActiveIngredientKey[];
  /** Raw INCI text tokens that matched no known class — a live matcher-table-gap signal. */
  unresolvedIngredientTokens: string[];
  /** Best-evidenced potency per key, when the raw-INCI path found one. Internal
   *  to the builder pipeline (not part of the public ProductProfile shape). */
  potencyByKey: Partial<Record<ActiveIngredientKey, Potency>>;
}

function sortKeys(keys: Iterable<ActiveIngredientKey>): ActiveIngredientKey[] {
  return [...new Set(keys)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** True when the key resolves (after legacy normalization) to a real actives.json class. */
function isKnownClass(key: ActiveIngredientKey): boolean {
  return ACTIVES_RULESET.classes[normalizeActiveKey(key)] !== undefined;
}

/**
 * Comma-split-trim-filter tokenizer shared by every raw-INCI-text consumer in
 * this pipeline (2026-08-26 decision batch, FE-9): this module's own
 * unresolved-token detection, `ExploreCompositionResultScreen.tsx`'s
 * ingredient list, and `shelfComparison.ts`'s per-item ingredient count all
 * call this one export instead of each keeping a private copy (resolves
 * tech-lead's prior non-blocking WARNING about a duplicated implementation).
 */
export function tokenizeIngredientsText(rawText: string): string[] {
  return rawText
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * A comma-token is "resolved" if the parser finds a match when it is
 * evaluated on its own — reuses `parseActiveIngredientDetails` per token
 * rather than reimplementing matcher/negative-pattern logic. A token gated
 * out of the whole-text parse by a position rule (e.g.
 * `requireWithinPosition`) still counts as "known" here: that's an
 * intentional attribution decision, not a matcher-table gap, so it must not
 * be reported as unresolved.
 */
function findUnresolvedTokens(inciText: string): string[] {
  const tokens = tokenizeIngredientsText(inciText);

  return tokens.filter((token) => parseActiveIngredientDetails(token).length === 0);
}

/**
 * Applies `DEFAULT_TAG_POTENCY` to any key in `keys` that has no evidenced
 * potency yet and whose class differentiates by potency at all. Shared by
 * both entry points below: a class confirmed present with no independent
 * potency evidence — a wizard-confirmed tag, or a corpus-resolved key, the
 * same situation from two different sources — must never silently read as
 * the lowest tier (2026-08-06 review finding; mirrors
 * `routineEngine/productFacts.ts`'s `attributeClasses`: "unconfirmed" is
 * not the same claim as "low"). Mutates `potencyByKey` in place.
 */
function applyTagPotencyDefaults(
  keys: ActiveIngredientKey[],
  potencyByKey: Partial<Record<ActiveIngredientKey, Potency>>,
): void {
  for (const key of keys) {
    if (potencyByKey[key] !== undefined) continue;
    const classHasPotency = ACTIVES_RULESET.classes[key].matchers.some(
      (m) => m.potency !== undefined,
    );
    if (classHasPotency) {
      potencyByKey[key] = DEFAULT_TAG_POTENCY;
    }
  }
}

/**
 * Stage 1, raw-INCI-text entry point (`ProductForm` manual-save path). Unions
 * wizard-confirmed `activeTags` with classes matched from `fullIngredientText`
 * — mirrors `routineEngine/productFacts.ts`'s tag-wins-authoritative
 * convention without importing that routine-engine-private module.
 */
export function resolveFromProduct(product: Product): ResolvedIngredients {
  const tagKeys = (product.activeTags ?? [])
    .map((key) => normalizeActiveKey(key))
    .filter(isKnownClass);

  const parsed = product.fullIngredientText
    ? parseActiveIngredientDetails(product.fullIngredientText)
    : [];

  const potencyByKey: Partial<Record<ActiveIngredientKey, Potency>> = {};
  for (const detail of parsed) {
    if (detail.potency !== undefined) {
      potencyByKey[detail.key] = detail.potency as Potency;
    }
  }
  applyTagPotencyDefaults(tagKeys, potencyByKey);

  const resolvedActiveKeys = sortKeys([...tagKeys, ...parsed.map((d) => d.key)]);
  const unresolvedIngredientTokens = product.fullIngredientText
    ? findUnresolvedTokens(product.fullIngredientText)
    : [];

  return { resolvedActiveKeys, unresolvedIngredientTokens, potencyByKey };
}

/**
 * Stage 1, raw-INCI-text entry point with no `Product` yet (Explore
 * Composition flow — docs/tech-design/explore-composition.md FE-3). Same
 * internals as `resolveFromProduct`'s text path, minus the wizard-confirmed
 * `activeTags` union step (there is no product record to carry tags from
 * yet): `parseActiveIngredientDetails` for resolved keys/potency,
 * `findUnresolvedTokens` for the matcher-table-gap signal.
 */
export function resolveFromRawText(inciText: string): ResolvedIngredients {
  const parsed = parseActiveIngredientDetails(inciText);

  const potencyByKey: Partial<Record<ActiveIngredientKey, Potency>> = {};
  for (const detail of parsed) {
    if (detail.potency !== undefined) {
      potencyByKey[detail.key] = detail.potency as Potency;
    }
  }

  const resolvedActiveKeys = sortKeys(parsed.map((d) => d.key));
  applyTagPotencyDefaults(resolvedActiveKeys, potencyByKey);

  const unresolvedIngredientTokens = findUnresolvedTokens(inciText);

  return { resolvedActiveKeys, unresolvedIngredientTokens, potencyByKey };
}

/**
 * Stage 1, resolved-corpus entry point — `activeKeys` are already parsed;
 * still normalized through the same legacy-key map so both entry paths land
 * in identical key space. No free text, so no unresolved tokens — but a
 * resolved key gets the same conservative `DEFAULT_TAG_POTENCY` treatment
 * as a tag-only key in `resolveFromProduct` (2026-08-06 fix), since the
 * corpus supplies no independent potency evidence either.
 */
export function resolveFromActiveKeys(activeKeys: ActiveIngredientKey[]): ResolvedIngredients {
  const resolvedActiveKeys = sortKeys(
    activeKeys.map((key) => normalizeActiveKey(key)).filter(isKnownClass),
  );

  const potencyByKey: Partial<Record<ActiveIngredientKey, Potency>> = {};
  applyTagPotencyDefaults(resolvedActiveKeys, potencyByKey);

  return { resolvedActiveKeys, unresolvedIngredientTokens: [], potencyByKey };
}
