/**
 * Component tests — BrandNameCategorySection, cover-photo capture and the
 * "Read label" helper. Covers the UX change where taking/choosing a photo
 * ONLY sets the product cover (no OCR runs automatically); OCR is opt-in via
 * a secondary "Need help filling the fields? → Read label" strip that only
 * appears once a cover photo exists.
 * Key guarantees:
 *  - Take Photo / Choose photo from library store the photo and dispatch
 *    SET_IMAGE — they never touch OCR/brand/name state;
 *  - the "Read label" helper is hidden before a photo exists, and appears
 *    once draft.localImageUri is set;
 *  - tapping "Read label" opens the camera modal in existing-photo mode
 *    (verified via the mocked modal receiving sourceImageUri), not a fresh
 *    capture prompt.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text: RNText } = require('react-native');
  return {
    Feather: ({ name }: { name: string }) => <RNText>{`icon-${name}`}</RNText>,
  };
});

// Heavy native module boundary: the camera modal is stubbed with a marker
// that surfaces the props this test cares about (visible/sourceImageUri),
// mirroring the pattern in brand-suggestion.test.tsx.
jest.mock('@/components/camera/CameraCaptureModal', () => {
  const { Text: RNText } = require('react-native');
  return {
    CameraCaptureModal: ({
      visible,
      sourceImageUri,
    }: {
      visible: boolean;
      sourceImageUri?: string;
    }) =>
      visible ? (
        <RNText>{`camera-open sourceImageUri=${sourceImageUri ?? 'none'}`}</RNText>
      ) : null,
  };
});

jest.mock('@/services/productImage', () => ({
  pickAndStoreProductPhoto: jest.fn(),
}));

jest.mock('@/utils/productForm/brandLookup', () => ({
  searchBrands: jest.fn().mockResolvedValue([]),
}));

import { BrandNameCategorySection } from '@/components/addProduct/BrandNameCategorySection';
import { pickAndStoreProductPhoto } from '@/services/productImage';

import { makeDraft } from './fixtures';

const mockPickAndStore = pickAndStoreProductPhoto as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BrandNameCategorySection — cover photo capture (OCR-free)', () => {
  it('stores the photo and dispatches SET_IMAGE without touching brand/name/OCR state', async () => {
    mockPickAndStore.mockResolvedValue({ localImageUri: 'file:///stored/cover.jpg' });
    const dispatch = jest.fn();
    render(
      <BrandNameCategorySection draft={makeDraft()} dispatch={dispatch} productId="p1" />,
    );

    fireEvent.press(screen.getByText('Take product photo'));

    expect(mockPickAndStore).toHaveBeenCalledWith('p1', 'camera');
    await Promise.resolve();
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_IMAGE', uri: 'file:///stored/cover.jpg' });
    // No OCR/brand/name dispatch was fired by capturing the cover photo.
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_BRAND' }));
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_NAME' }));
  });

  it('uses the library source when "Choose photo from library" is pressed', async () => {
    mockPickAndStore.mockResolvedValue({ localImageUri: 'file:///stored/cover.jpg' });
    const dispatch = jest.fn();
    render(
      <BrandNameCategorySection draft={makeDraft()} dispatch={dispatch} productId="p1" />,
    );

    fireEvent.press(screen.getByText('Choose photo from library'));

    expect(mockPickAndStore).toHaveBeenCalledWith('p1', 'library');
  });

  it('does not dispatch SET_IMAGE when the user cancels the picker', async () => {
    mockPickAndStore.mockResolvedValue(null);
    const dispatch = jest.fn();
    render(
      <BrandNameCategorySection draft={makeDraft()} dispatch={dispatch} productId="p1" />,
    );

    fireEvent.press(screen.getByText('Take product photo'));
    await Promise.resolve();

    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_IMAGE' }));
  });
});

describe('BrandNameCategorySection — "Read label" helper visibility', () => {
  it('is hidden before a cover photo exists', () => {
    render(
      <BrandNameCategorySection draft={makeDraft()} dispatch={jest.fn()} productId="p1" />,
    );

    expect(screen.queryByText('Need help filling the fields?')).toBeNull();
    expect(screen.queryByText('Read label')).toBeNull();
  });

  it('appears once the draft carries a cover photo', () => {
    render(
      <BrandNameCategorySection
        draft={makeDraft({ localImageUri: 'file:///stored/cover.jpg' })}
        dispatch={jest.fn()}
        productId="p1"
      />,
    );

    expect(screen.getByText('Need help filling the fields?')).toBeTruthy();
    expect(screen.getByText('Read label')).toBeTruthy();
  });

  it('opens the camera modal in existing-photo mode, not a fresh capture', () => {
    render(
      <BrandNameCategorySection
        draft={makeDraft({ localImageUri: 'file:///stored/cover.jpg' })}
        dispatch={jest.fn()}
        productId="p1"
      />,
    );

    fireEvent.press(screen.getByText('Read label'));

    expect(
      screen.getByText('camera-open sourceImageUri=file:///stored/cover.jpg'),
    ).toBeTruthy();
  });
});
