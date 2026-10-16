import { isOwnedProduct } from '@/utils/productOwnership';

describe('isOwnedProduct', () => {
  it('treats an explicit owned product as owned', () => {
    expect(isOwnedProduct({ status: 'owned' })).toBe(true);
  });

  it('treats a product with no status (legacy record) as owned', () => {
    expect(isOwnedProduct({})).toBe(true);
  });

  it('treats a wishlist product as not owned', () => {
    expect(isOwnedProduct({ status: 'wishlist' })).toBe(false);
  });
});
