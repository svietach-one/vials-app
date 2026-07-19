/**
 * Component tests — ProductThumbnail (img-02). The file-existence probe is
 * mocked at the module boundary; @expo/vector-icons is stubbed. Contract:
 * precedence (localImageUri ?? imageUrl ?? placeholder), the placeholder for
 * empty products, the onError → placeholder fallback, the Android
 * dangling-local-file → placeholder fallback, and the dimmed style.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { localPhotoExists } from '@/services/imageFile';
import type { Product } from '@/types';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <View testID={`feather-icon-${name}`} /> };
});

jest.mock('@/services/imageFile', () => ({
  localPhotoExists: jest.fn(async () => true),
}));

import { ProductThumbnail } from '@/components/ui/ProductThumbnail';

const mockExists = localPhotoExists as jest.MockedFunction<typeof localPhotoExists>;

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Test Serum',
    brand: 'Vials',
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExists.mockResolvedValue(true);
});

describe('ProductThumbnail', () => {
  it('renders the placeholder when the product has no image', () => {
    render(<ProductThumbnail product={makeProduct()} />);
    expect(screen.getByTestId('product-thumbnail-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('product-thumbnail-image')).toBeNull();
  });

  it('renders a remote image when imageUrl is set and no local photo', () => {
    render(<ProductThumbnail product={makeProduct({ imageUrl: 'https://cdn/x.jpg' })} />);
    const img = screen.getByTestId('product-thumbnail-image');
    expect(img.props.source.uri).toBe('https://cdn/x.jpg');
    expect(screen.queryByTestId('product-thumbnail-placeholder')).toBeNull();
  });

  it('prefers the local photo over the remote URL (precedence)', () => {
    render(
      <ProductThumbnail
        product={makeProduct({ localImageUri: 'file:///local.jpg', imageUrl: 'https://cdn/x.jpg' })}
      />,
    );
    expect(screen.getByTestId('product-thumbnail-image').props.source.uri).toBe('file:///local.jpg');
  });

  it('falls back to the placeholder when a remote image errors', () => {
    render(<ProductThumbnail product={makeProduct({ imageUrl: 'https://cdn/broken.jpg' })} />);
    fireEvent(screen.getByTestId('product-thumbnail-image'), 'error');
    expect(screen.getByTestId('product-thumbnail-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('product-thumbnail-image')).toBeNull();
  });

  it('falls back to the placeholder when a local file no longer exists (Android dangling URI)', async () => {
    mockExists.mockResolvedValue(false);
    render(<ProductThumbnail product={makeProduct({ localImageUri: 'file:///gone.jpg' })} />);

    // Shown optimistically, then replaced once the async existence check resolves false.
    await waitFor(() => expect(screen.getByTestId('product-thumbnail-placeholder')).toBeTruthy());
    expect(screen.queryByTestId('product-thumbnail-image')).toBeNull();
  });

  it('does not probe the filesystem for a remote-only image', () => {
    render(<ProductThumbnail product={makeProduct({ imageUrl: 'https://cdn/x.jpg' })} />);
    expect(mockExists).not.toHaveBeenCalled();
  });

  it('applies a dimmed opacity when dimmed', () => {
    render(<ProductThumbnail product={makeProduct()} dimmed />);
    const flat = StyleSheet.flatten(screen.getByTestId('product-thumbnail').props.style);
    expect(flat.opacity).toBe(0.4);
  });
});
