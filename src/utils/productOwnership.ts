import type { Product } from '@/types';

/**
 * Whether a product is on the user's shelf rather than on her wishlist.
 *
 * `Product.status` is optional on purpose: every record saved before Wishlist
 * existed is implicitly owned (same convention as `isHidden`). A wishlist
 * product has no inventory side effects, so the routine engine, the live gap
 * cards and the Draft Preview must all ignore it — they share this one
 * predicate so they cannot disagree.
 */
export function isOwnedProduct(product: Pick<Product, 'status'>): boolean {
  return product.status !== 'wishlist';
}
