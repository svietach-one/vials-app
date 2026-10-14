import type { Product, ProductType } from '../../types';

/**
 * A surfactant-based makeup/SPF remover (micellar water, cleansing oil/balm,
 * démaquillant). These are pre-cleanse products — they do not rinse clean and
 * are not a standalone cleanse — so they must be classified apart from a
 * gentle rinse-off cleanser. Matched ahead of the generic cleanser pattern.
 */
const MAKEUP_REMOVER_PATTERN =
  /\bmicellar\b|cleansing\s+(oil|balm|water)|makeup\s*-?\s*remov|make-?up\s*-?\s*remov|d[ée]maquillant/i;

/** True when a product's name reads as a makeup remover / pre-cleanse. */
export function isMakeupRemoverName(text: string): boolean {
  return MAKEUP_REMOVER_PATTERN.test(text);
}

/**
 * Read-time classification guard: a product typed as a plain `cleanser` whose
 * name reads as a micellar water / cleansing oil / cleansing balm / makeup
 * remover is reclassified to `makeup_remover`. Catches mistyped DB/corpus
 * imports so the pre_cleanse slot + follow-up rule are not silently missed.
 * Pure — returns the same reference when no change is needed.
 */
export function reclassifyMakeupRemover(product: Product): Product {
  // `balm` joined the list on 2026-10-14: since balms now fill the moisturiser
  // slot, a cleansing balm left typed `balm` would be scheduled as a leave-on
  // hydrator. The same product typed `cleanser` already became a pre_cleanse,
  // so this closes a gap in the 2026-07-19 ruling rather than extending it.
  if (product.productType !== 'cleanser' && product.productType !== 'balm') return product;
  if (!isMakeupRemoverName(product.name)) return product;
  return { ...product, productType: 'makeup_remover' };
}

/**
 * A gel-textured moisturiser ("gel cream", "crème-gel", "żel-krem"). The
 * catalog's `gel` type sits at the SERUM layer (LAYERING_ORDER index 6), so a
 * product left typed `gel` can never fill the moisturiser slot — it is simply
 * reserved, with no routine step and (before 2026-10-14) no prompt.
 *
 * Only an explicit gel+cream COMPOUND matches. A bare "Hydrating Gel" stays a
 * gel on purpose: a gel serum and a gel moisturiser are genuinely different
 * products and the name alone cannot tell them apart — the one safe signal is
 * the user writing "cream" on it.
 */
const GEL_CREAM_PATTERN =
  /gel[\s-]*cream|cream[\s-]*gel|gel[\s-]*cr[èe]me|cr[èe]me[\s-]*gel|gel[\s-]*krem|krem[\s-]*żel|żel[\s-]*krem/i;

/** True when a product's name reads as a gel-textured moisturiser. */
export function isGelCreamName(text: string): boolean {
  return GEL_CREAM_PATTERN.test(text);
}

/**
 * Read-time guard for the `gel` type, mirroring {@link reclassifyMakeupRemover}.
 * Auto-detection never produces `gel` (it is absent from CATEGORY_PATTERNS, and
 * `\bcream\b` already routes "Gel Cream" to `moisturizer`), so this only
 * catches a manual pill pick or a DB/corpus import. Pure.
 */
export function reclassifyGelCream(product: Product): Product {
  if (product.productType !== 'gel') return product;
  if (!isGelCreamName(product.name)) return product;
  return { ...product, productType: 'moisturizer' };
}

/**
 * A lip product. `balm` fills the moisturiser slot since 2026-10-14, which
 * would otherwise schedule a lip balm as a twice-daily FACE step (tech-lead
 * review 2026-10-14, W3). Demoted to `other` so it carries no structural slot
 * and is simply kept in reserve, rather than being silently retyped into some
 * other face category.
 */
const LIP_PRODUCT_PATTERN = /\blip[\s-]|\blips\b|\bl[eè]vres\b|\bust\b|\bpomadka\b/i;

/**
 * Hair and scalp care. The bundled corpus carries 38 hair balms against ~6 face
 * balms (tech-lead re-review 2026-10-14, W3), and corpus search is not filtered
 * by product type, so without this a "Бальзам для волос" is scheduled as a
 * twice-daily face step AND suppresses the missing-moisturiser prompt.
 */
const HAIR_PRODUCT_PATTERN = /\bhair\b|\bscalp\b|cheveux|\bw[łl]os|волос|кожи\s+головы/i;

/** True when a product's name reads as a lip product rather than face care. */
export function isLipProductName(text: string): boolean {
  return LIP_PRODUCT_PATTERN.test(text);
}

/** True when a product's name reads as hair/scalp care rather than face care. */
export function isHairProductName(text: string): boolean {
  return HAIR_PRODUCT_PATTERN.test(text);
}

/** Balms that are not face care are demoted to `other`, which carries no
 *  structural slot, so they are kept in reserve instead of being retyped into
 *  some other face category. */
function demoteNonFaceBalm(product: Product): Product {
  if (product.productType !== 'balm') return product;
  if (!isLipProductName(product.name) && !isHairProductName(product.name)) return product;
  return { ...product, productType: 'other' };
}

/**
 * The single read-time normalisation every consumer should use: the catalog
 * type a product should be TREATED as, whatever is persisted on it. Composes
 * the individual guards (their input types are disjoint, so order is
 * irrelevant). Pure — same reference when nothing changes.
 */
export function normalizeProductType(product: Product): Product {
  // Order matters: the makeup-remover guard runs FIRST so a "Cleansing Balm"
  // becomes a pre_cleanse rather than being demoted out of the routine.
  return demoteNonFaceBalm(reclassifyGelCream(reclassifyMakeupRemover(product)));
}

/**
 * First match wins, so ambiguous labels resolve to the earlier pattern
 * (e.g. "sunscreen serum" → 'serum', not 'spf'). Deliberately kept naive:
 * the category pill is always user-overridable, so a wrong guess costs one
 * tap. Detected types stay within the wizard's fixed 8-option pill row
 * (CategoryPillRow), which is why "cream" maps to 'moisturizer' rather
 * than the catalog's separate 'cream' type.
 *
 * French/Polish keywords come from LATIN_COMMON_TERMS (brandDictionary.ts,
 * spec section 5) mapped onto the same 8 pills — the flat per-language term
 * lists carry no category mapping, so that mapping is encoded here. Stems
 * are used where the language inflects ("nawilżając" covers "nawilżający"/
 * "nawilżająca"), and \b is kept away from non-ASCII letters, where JS's
 * ASCII-only word boundary misbehaves.
 */
const CATEGORY_PATTERNS: Array<[RegExp, ProductType]> = [
  [/\bs[ée]rum\b/i, 'serum'],
  [/\bcream\b|moistur|cr[èe]me|hydratant|\bkrem\b|nawilżając/i, 'moisturizer'],
  // Makeup removers before the generic cleanser rule — a pre-cleanse, not a cleanse.
  [MAKEUP_REMOVER_PATTERN, 'makeup_remover'],
  [/\bclean(s|z)er|\bwash\b|nettoyant|\blavant\b|myjąc|oczyszczając/i, 'cleanser'],
  [/\btoner|toni(c|k|que)\b/i, 'toner'],
  [/\bspf\s?\d+|sunscreen|sun\s?screen|[ée]cran solaire|przeciwsłoneczn/i, 'spf'],
  [/\bmask\b|\bmask[aęi]\b|\bmasque\b|maseczk/i, 'mask'],
  [/\boil\b|\bhuile\b|\bolej/i, 'oil'],
  [/\bexfoliant|peeling|scrub|gommage|złuszczając/i, 'peeling'],
];

export function detectCategory(rawOcrText: string): ProductType | null {
  for (const [pattern, type] of CATEGORY_PATTERNS) {
    if (pattern.test(rawOcrText)) return type;
  }
  return null;
}
