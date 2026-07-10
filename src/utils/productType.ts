import type { ProductType } from '@/types';

const PRODUCT_TYPES = new Set<ProductType>([
  'cleanser',
  'toner',
  'essence',
  'serum',
  'gel',
  'moisturizer',
  'oil',
  'spf',
  'makeup_remover',
  'peeling',
  'ampoule',
  'lotion',
  'cream',
  'eye_cream',
  'mask',
  'balm',
  'spot_treatment',
  'other',
]);

/** Corpus `products.type` is a free-text vocabulary column — fall back to 'other' if it doesn't match. */
export function resolveProductType(corpusType: string): ProductType {
  return PRODUCT_TYPES.has(corpusType as ProductType) ? (corpusType as ProductType) : 'other';
}
