/**
 * Component tests — BrandNameCategorySection × OCR brand-correction dictionary
 * (docs/specs/ocr-brand-dictionary-reference.md).
 * Key guarantees:
 *  - a dictionary match is surfaced as a "Did you mean …?" suggestion, while
 *    the field keeps the RAW OCR text — a correction is never applied
 *    automatically (spec caveat 3);
 *  - accepting the suggestion is what replaces the text; dismissing keeps
 *    the raw OCR text and removes the prompt;
 *  - clean OCR results (already-correct brand spellings) get no prompt.
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
// whose press simulates a label capture. Tests vary the OCR payload through
// the factory-scoped setter reached back out via jest.requireMock.
jest.mock('@/components/camera/CameraCaptureModal', () => {
  const { Pressable, Text: RNText } = require('react-native');
  const state = { rawText: '' };
  return {
    CameraCaptureModal: ({
      visible,
      mode,
      onCapture,
    }: {
      visible: boolean;
      mode: string;
      onCapture: (result: unknown) => void;
    }) =>
      visible ? (
        <Pressable onPress={() => onCapture({ mode: 'label', rawText: state.rawText })}>
          <RNText>{`camera-open-${mode}`}</RNText>
        </Pressable>
      ) : null,
    __state: state,
  };
});

// brandLookup pulls in the products store → AsyncStorage native module;
// autocomplete is out of scope here, so stub it at the module boundary.
jest.mock('@/utils/productForm/brandLookup', () => ({
  searchBrands: jest.fn().mockResolvedValue([]),
}));

import { BrandNameCategorySection } from '@/components/addProduct/BrandNameCategorySection';

import { makeDraft } from './fixtures';

const cameraMock = jest.requireMock('@/components/camera/CameraCaptureModal') as {
  __state: { rawText: string };
};

function captureLabel(rawText: string, dispatch = jest.fn()) {
  cameraMock.__state.rawText = rawText;
  render(<BrandNameCategorySection draft={makeDraft()} dispatch={dispatch} />);
  fireEvent.press(screen.getByLabelText('Scan front label'));
  fireEvent.press(screen.getByText('camera-open-label'));
  return dispatch;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BrandNameCategorySection — OCR brand suggestions', () => {
  it('keeps the raw OCR text in the brand field and only *offers* the dictionary spelling', () => {
    const dispatch = captureLabel('BIODERMO');

    // The raw text is what lands in the field…
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_BRAND', value: 'BIODERMO', source: 'ocr' });
    // …the corrected spelling is only a prompt, not a dispatch.
    expect(screen.getByText('Did you mean “Bioderma”?')).toBeTruthy();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_BRAND', value: 'Bioderma' }),
    );
  });

  it('applies the suggested spelling only after the user taps Use', () => {
    const dispatch = captureLabel('BIODERMO');

    fireEvent.press(screen.getByLabelText('Use suggested brand Bioderma'));

    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_BRAND', value: 'Bioderma', source: 'ocr' });
    expect(screen.queryByText('Did you mean “Bioderma”?')).toBeNull();
  });

  it('retires the single-line chip pool after the suggestion is accepted', () => {
    captureLabel('BIODERMO');

    fireEvent.press(screen.getByLabelText('Use suggested brand Bioderma'));

    // The pool only existed to host the suggestion — nothing may linger.
    expect(screen.queryByText('Detected text — tap a line to assign it')).toBeNull();
  });

  it('retires the single-line chip pool after the suggestion is dismissed', () => {
    captureLabel('BIODERMO');

    fireEvent.press(screen.getByLabelText('Dismiss suggestion Bioderma'));

    expect(screen.queryByText('Detected text — tap a line to assign it')).toBeNull();
  });

  it('keeps the raw OCR text when the suggestion is dismissed', () => {
    const dispatch = captureLabel('BIODERMO');

    fireEvent.press(screen.getByLabelText('Dismiss suggestion Bioderma'));

    expect(screen.queryByText('Did you mean “Bioderma”?')).toBeNull();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ value: 'Bioderma' }),
    );
  });

  it('shows no suggestion when OCR already reads a dictionary brand correctly', () => {
    captureLabel('Bioderma');

    expect(screen.queryByText(/Did you mean/)).toBeNull();
  });

  it('offers per-line suggestions in the multi-line chip pool without touching any field', () => {
    const dispatch = captureLabel('BIODERMO\nAtoderm Ultra');

    // Multi-line: nothing is assigned yet, so no field dispatches at all…
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_BRAND' }));
    // …but the typo'd line still gets its prompt in the picker.
    expect(screen.getByText('Did you mean “Bioderma”?')).toBeTruthy();
  });

  it('uses the accepted spelling when the chip is assigned after accepting', () => {
    const dispatch = captureLabel('BIODERMO\nAtoderm Ultra');

    fireEvent.press(screen.getByLabelText('Use suggested brand Bioderma'));
    fireEvent.press(screen.getByLabelText('Detected line: Bioderma'));
    fireEvent.press(screen.getByLabelText('Assign to Brand'));

    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_BRAND', value: 'Bioderma', source: 'ocr' });
  });
});
