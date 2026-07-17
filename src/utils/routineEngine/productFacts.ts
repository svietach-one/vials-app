import {
  ACTIVES_RULESET,
  resolveIrritancy,
  type Period,
  type Potency,
} from '@/constants/rulesets/rulesetTypes';
import type { ActiveIngredientKey, Product, ProductType } from '@/types';
import {
  normalizeActiveKey,
  parseActiveIngredientDetails,
} from '@/utils/ingredientParser';
import { computePaoStatus } from '@/utils/paoHelpers';

/**
 * Pipeline step 1 — Facts. Aggregates a product to a single per-product record
 * the engine resolves on (rules are keyed on ingredient classes; freeze/swap/
 * move operates on products). Pure and deterministic: `now` is injected for
 * the PAO gate, output ordering is stable.
 */

/** One active class attributed to a product, with provenance. */
export interface ProductFactClass {
  key: ActiveIngredientKey;
  /**
   * Strongest potency evidenced for this class. Wizard-confirmed classes with
   * no INCI evidence default to 'high' (conservative: potency exceptions only
   * ever downgrade severity on LOW potency, so unknown must not soften rules).
   * Undefined only for classes whose matchers declare no potency at all.
   */
  potency?: Potency;
  /** 'tag' = wizard-confirmed (authoritative); 'parse' = INCI regex fallback. */
  source: 'tag' | 'parse';
}

/**
 * OR-merge of class boolean properties; irritancy is the max across classes,
 * each class resolved at its own attributed potency (a retinol and a tretinoin
 * are not equally irritating — see rulesetTypes.resolveIrritancy).
 */
export interface AggregatedProperties {
  photosensitizing: boolean;
  exfoliating: boolean;
  irritancy: number;
  barrierRepair: boolean;
  lowPh: boolean;
  spf: boolean;
  massageRequired: boolean;
}

export interface ProductFacts {
  productId: string;
  classes: ProductFactClass[];
  properties: AggregatedProperties;
  /** Intersection of every class's allowedPeriods ∩ product.usageTime. */
  allowedPeriods: Period[];
  /**
   * Washed off rather than left on the skin, derived from productType. A
   * rinse-off carrier of a strong active does not consume cumulative exposure
   * (the contact time is seconds, not hours) — consumed by the Phase 4
   * cumulative cap; unused until then.
   */
  rinseOff: boolean;
  /** Hard gate input: !isHidden && !paoExpired. */
  eligible: boolean;
}

/**
 * Only these two product types are unambiguously washed off. `peeling` and
 * `mask` are deliberately excluded: peel gels rinse but peel pads do not, and
 * sleeping masks are leave-on — do-no-harm means an ambiguous product consumes
 * the cumulative cap rather than escaping it (tech design Assumption 3).
 */
const RINSE_OFF_TYPES: readonly ProductType[] = ['cleanser', 'makeup_remover'];

const EMPTY_PROPERTIES: AggregatedProperties = {
  photosensitizing: false,
  exfoliating: false,
  irritancy: 0,
  barrierRepair: false,
  lowPh: false,
  spf: false,
  massageRequired: false,
};

const USAGE_TIME_PERIODS: Record<Product['usageTime'], Period[]> = {
  morning: ['am'],
  evening: ['pm'],
  both: ['am', 'pm'],
};

/** Conservative default for wizard-confirmed classes without INCI evidence. */
const DEFAULT_TAG_POTENCY: Potency = 'high';

function isPaoExpired(product: Product, now: Date): boolean {
  if (!product.openedDate || !product.paoMonths || product.paoMonths <= 0) return false;
  return computePaoStatus(product.openedDate, product.paoMonths, now).isExpired;
}

/**
 * Attributes active classes to a product. Wizard-confirmed keys (activeTags +
 * activeIngredients, legacy-normalized) are authoritative; the INCI parse
 * fills gaps and supplies potency evidence. Output is sorted by key.
 */
function attributeClasses(product: Product): ProductFactClass[] {
  const rulesetClasses = ACTIVES_RULESET.classes;

  // Wizard-confirmed keys win over the parse (per Product.activeTags contract).
  const tagKeys = new Set<ActiveIngredientKey>();
  for (const key of product.activeTags ?? []) tagKeys.add(normalizeActiveKey(key));
  for (const ing of product.activeIngredients) tagKeys.add(normalizeActiveKey(ing.key));

  const parsed = product.fullIngredientText
    ? parseActiveIngredientDetails(product.fullIngredientText)
    : [];
  const parsedPotency = new Map(parsed.map((d) => [d.key, d.potency]));

  const classes: ProductFactClass[] = [];
  for (const key of tagKeys) {
    const cls = rulesetClasses[key];
    if (!cls) continue; // unknown/legacy leftovers never reach the engine
    const classHasPotency = cls.matchers.some((m) => m.potency !== undefined);
    const evidenced = parsedPotency.get(key) as Potency | undefined;
    classes.push({
      key,
      source: 'tag',
      potency: evidenced ?? (classHasPotency ? DEFAULT_TAG_POTENCY : undefined),
    });
  }
  for (const detail of parsed) {
    if (tagKeys.has(detail.key)) continue; // already attributed to the tag
    if (!rulesetClasses[detail.key]) continue;
    classes.push({
      key: detail.key,
      source: 'parse',
      potency: detail.potency as Potency | undefined,
    });
  }
  return classes.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** OR-merges class properties (max irritancy) and intersects allowed periods. */
function aggregateProperties(
  classes: ProductFactClass[],
  usageTime: Product['usageTime'],
): { properties: AggregatedProperties; allowedPeriods: Period[] } {
  const properties: AggregatedProperties = { ...EMPTY_PROPERTIES };
  let allowedPeriods: Period[] = ['am', 'pm'];

  for (const { key, potency } of classes) {
    const cls = ACTIVES_RULESET.classes[key];
    const p = cls.properties;
    properties.photosensitizing ||= p.photosensitizing === true;
    properties.exfoliating ||= p.exfoliating === true;
    properties.barrierRepair ||= p.barrierRepair === true;
    properties.lowPh ||= p.lowPh === true;
    properties.spf ||= p.spf === true;
    properties.massageRequired ||= p.massageRequired === true;
    properties.irritancy = Math.max(properties.irritancy, resolveIrritancy(p, potency));
    allowedPeriods = allowedPeriods.filter((period) => cls.allowedPeriods.includes(period));
  }
  allowedPeriods = allowedPeriods.filter((period) =>
    USAGE_TIME_PERIODS[usageTime].includes(period),
  );

  return { properties, allowedPeriods };
}

/**
 * Builds the aggregated per-product facts record. A single formula containing
 * conflicting classes never flags against itself — pair rules apply across
 * products, so this record only lists classes, it draws no conclusions.
 */
export function buildProductFacts(product: Product, now: Date = new Date()): ProductFacts {
  const classes = attributeClasses(product);
  const { properties, allowedPeriods } = aggregateProperties(classes, product.usageTime);

  return {
    productId: product.id,
    classes,
    properties,
    allowedPeriods,
    rinseOff: RINSE_OFF_TYPES.includes(product.productType),
    eligible: product.isHidden !== true && !isPaoExpired(product, now),
  };
}

/** Builds facts for a whole shelf, keyed by productId (stable insertion order). */
export function buildShelfFacts(products: Product[], now: Date = new Date()): Map<string, ProductFacts> {
  return new Map(products.map((p) => [p.id, buildProductFacts(p, now)]));
}
