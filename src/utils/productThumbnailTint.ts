import { palette } from '@/constants/tokens';
import type { ProductType } from '@/types';

/**
 * Muted per-product-type background for the {@link ProductThumbnailPlaceholder}
 * (img-02). Derived from the same type→hue grouping the cards use for their
 * type badges (TYPE_COLORS), but rendered as an ultra-light wash — the full
 * hue at low alpha over the card surface — NOT the full-value Apothecary colors
 * (Amber / Cabernet / Green / Cobalt) and NOT the semantic `*Tint` tokens
 * (statusWarningTint etc.). Keeping this in a pure util means the placeholder
 * never hardcodes a colour and the wash stays semantically neutral.
 */

const WASH_ALPHA = 0.08;

/**
 * Type-family accent, by palette KEY (not value) so nothing reads `palette` at
 * module load — resolution is deferred to call time and tolerates a partial
 * palette without throwing.
 */
const TYPE_ACCENT_KEY: Partial<Record<ProductType, keyof typeof palette>> = {
  // Cobalt family — leave-on treatment liquids
  serum: 'cobalt',
  ampoule: 'cobalt',
  essence: 'cobalt',
  gel: 'cobalt',
  // Bottle-green family — cleansers, hydrators, oils
  cleanser: 'bottleGreen',
  toner: 'bottleGreen',
  moisturizer: 'bottleGreen',
  cream: 'bottleGreen',
  lotion: 'bottleGreen',
  oil: 'bottleGreen',
  eye_cream: 'bottleGreen',
  balm: 'bottleGreen',
  // Amber family — sun care, masks, exfoliants, spot treatment
  spf: 'amber',
  mask: 'amber',
  peeling: 'amber',
  spot_treatment: 'amber',
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Returns the placeholder wash colour for a product type. */
export function getProductThumbnailTint(productType: ProductType): string {
  const key = TYPE_ACCENT_KEY[productType];
  const accent = (key && palette[key]) || palette.zinc400;
  // Defensive: a display util must never throw on a malformed/absent colour.
  if (typeof accent !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(accent)) return 'transparent';
  return hexToRgba(accent, WASH_ALPHA);
}
