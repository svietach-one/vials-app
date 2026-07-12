/**
 * Component tests — IngredientsSection + BarcodeSection (tasks 05/07, QA task 10;
 * post-OCR UX + multi-shot per camera-and-form-fixes Steps 0/4).
 * Key guarantees:
 *  - a FIRST INCI scan is unreachable except through InciScanNotice, and the
 *    notice reappears on every tap (no persisted dismissal); the multi-shot
 *    re-shoot ("Add another shot") deliberately bypasses the notice;
 *  - "Use manual checklist instead" never opens the camera;
 *  - zero actives is rendered as a neutral, valid state;
 *  - raw OCR text is expanded immediately and clearable independently of
 *    manual checklist picks;
 *  - barcode skip is a full-weight button dispatching SKIP_BARCODE.
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
// that renders only when the section actually sets it visible. Pressing the
// marker simulates a successful INCI capture so the multi-shot merge is
// testable without any camera machinery.
jest.mock('@/components/camera/CameraCaptureModal', () => {
  const { Pressable, Text: RNText } = require('react-native');
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
        <Pressable
          onPress={() => onCapture({ mode: 'inci', rawText: 'Tocopherol', hadNonLatin: false })}
        >
          <RNText>{`camera-open-${mode}`}</RNText>
        </Pressable>
      ) : null,
  };
});

// State lives INSIDE the factory (module-body variables are unreliable in
// hoisted factories); tests reach it back out via jest.requireMock.
jest.mock('@/store/settingsStore', () => {
  const state = { communityContributionCount: 3, incrementCommunityContribution: jest.fn() };
  return {
    useSettingsStore: (selector: (s: typeof state) => unknown) => selector(state),
    __state: state,
  };
});

import { BarcodeSection } from '@/components/addProduct/BarcodeSection';
import { IngredientsSection } from '@/components/addProduct/IngredientsSection';

import { makeDraft } from './fixtures';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('IngredientsSection — INCI notice gating', () => {
  it('shows the language notice instead of the camera when "Scan INCI list" is tapped', () => {
    render(<IngredientsSection draft={makeDraft()} dispatch={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Scan INCI list'));

    expect(screen.getByText('Scan the original ingredients list')).toBeTruthy();
    expect(screen.queryByText('camera-open-inci')).toBeNull();
  });

  it('opens the INCI camera only via "Got it, scan now"', () => {
    render(<IngredientsSection draft={makeDraft()} dispatch={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Scan INCI list'));
    fireEvent.press(screen.getByText('Got it, scan now'));

    expect(screen.getByText('camera-open-inci')).toBeTruthy();
  });

  it('never opens the camera when "Use manual checklist instead" is chosen', () => {
    render(<IngredientsSection draft={makeDraft()} dispatch={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Scan INCI list'));
    fireEvent.press(screen.getByText('Use manual checklist instead'));

    expect(screen.queryByText('camera-open-inci')).toBeNull();
  });

  it('re-shows the notice on every tap within one session (no persisted dismissal)', () => {
    render(<IngredientsSection draft={makeDraft()} dispatch={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Scan INCI list'));
    fireEvent.press(screen.getByText('Use manual checklist instead'));
    fireEvent.press(screen.getByLabelText('Scan INCI list'));

    expect(screen.getByText('Scan the original ingredients list')).toBeTruthy();
  });

  it('dispatches TOGGLE_ACTIVE_KEY from the manual checklist', () => {
    const dispatch = jest.fn();
    render(<IngredientsSection draft={makeDraft()} dispatch={dispatch} />);

    fireEvent.press(screen.getByLabelText('Retinoids'));

    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_ACTIVE_KEY', key: 'retinoid' });
  });

  it('renders zero detected actives after OCR as a neutral note, not an error', () => {
    const draft = makeDraft({ inciRaw: 'Aqua, Glycerin', activeIngredientKeys: [] });
    render(<IngredientsSection draft={draft} dispatch={jest.fn()} />);

    expect(
      screen.getByText("No known actives detected — that's fine for a plain product."),
    ).toBeTruthy();
  });

  it('shows the same-day conflict preview when detected keys form a rule pair', () => {
    const draft = makeDraft({
      inciRaw: 'Aqua, Retinol, Glycolic Acid',
      activeIngredientKeys: ['retinoid', 'aha'],
    });
    render(<IngredientsSection draft={draft} dispatch={jest.fn()} />);

    expect(screen.getByText('Retinoids + AHA')).toBeTruthy();
  });
});

describe('IngredientsSection — post-OCR raw text and manual fallback', () => {
  it('shows the raw INCI text expanded immediately after OCR, without opening the dropdown', () => {
    const draft = makeDraft({ inciRaw: 'Aqua, Glycerin' });
    render(<IngredientsSection draft={draft} dispatch={jest.fn()} />);

    expect(screen.getByLabelText('Full INCI text')).toBeTruthy();
  });

  it('dispatches CLEAR_INCI_RAW from the raw-text clear button', () => {
    const dispatch = jest.fn();
    const draft = makeDraft({
      inciRaw: 'Aqua, Retinol',
      activeIngredientKeys: ['retinoid'],
      ocrDerivedKeys: ['retinoid'],
    });
    render(<IngredientsSection draft={draft} dispatch={dispatch} />);

    fireEvent.press(screen.getByLabelText('Clear INCI text'));

    expect(dispatch).toHaveBeenCalledWith({ type: 'CLEAR_INCI_RAW' });
  });

  it('offers "Choose actives manually" after a garbled OCR result with zero matches', () => {
    const draft = makeDraft({ inciRaw: 'zx@@ qq11', activeIngredientKeys: [] });
    render(<IngredientsSection draft={draft} dispatch={jest.fn()} />);

    expect(screen.getByLabelText('Choose actives manually')).toBeTruthy();
  });

  it('opening the manual checklist keeps the raw text visible', () => {
    const draft = makeDraft({ inciRaw: 'zx@@ qq11', activeIngredientKeys: [] });
    render(<IngredientsSection draft={draft} dispatch={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Choose actives manually'));

    expect(screen.getByLabelText('Retinoids')).toBeTruthy();
    expect(screen.getByLabelText('Full INCI text')).toBeTruthy();
  });
});

describe('IngredientsSection — multi-shot re-scan', () => {
  it('opens the INCI camera directly from "Add another shot", skipping the notice', () => {
    const draft = makeDraft({ inciRaw: 'Aqua, Glycerin' });
    render(<IngredientsSection draft={draft} dispatch={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Add another shot'));

    expect(screen.getByText('camera-open-inci')).toBeTruthy();
    expect(screen.queryByText('Scan the original ingredients list')).toBeNull();
  });

  it('concatenates a re-shoot result onto the existing raw text with a comma', () => {
    const dispatch = jest.fn();
    const draft = makeDraft({ inciRaw: 'Aqua, Glycerin' });
    render(<IngredientsSection draft={draft} dispatch={dispatch} />);

    fireEvent.press(screen.getByLabelText('Add another shot'));
    fireEvent.press(screen.getByText('camera-open-inci'));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'APPLY_INCI_OCR_RESULT',
        rawText: 'Aqua, Glycerin, Tocopherol',
      }),
    );
  });

  it('replaces (not concatenates) when a fresh scan starts from the notice', () => {
    const dispatch = jest.fn();
    const draft = makeDraft({ inciRaw: 'Aqua, Glycerin' });
    render(<IngredientsSection draft={draft} dispatch={dispatch} />);

    fireEvent.press(screen.getByLabelText('Scan INCI list'));
    fireEvent.press(screen.getByText('Got it, scan now'));
    fireEvent.press(screen.getByText('camera-open-inci'));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'APPLY_INCI_OCR_RESULT',
        rawText: 'Tocopherol',
      }),
    );
  });
});

describe('BarcodeSection', () => {
  it('renders the skip path as a full button that dispatches SKIP_BARCODE', () => {
    const dispatch = jest.fn();
    render(<BarcodeSection draft={makeDraft()} dispatch={dispatch} />);

    fireEvent.press(screen.getByText('Skip — no barcode available'));

    expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_BARCODE' });
  });

  it('shows the local per-device contribution counter', () => {
    render(<BarcodeSection draft={makeDraft()} dispatch={jest.fn()} />);

    expect(screen.getByText("You've helped verify 3 products")).toBeTruthy();
  });

  it('opens the barcode camera from the scan tile', () => {
    render(<BarcodeSection draft={makeDraft()} dispatch={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Scan barcode'));

    expect(screen.getByText('camera-open-barcode')).toBeTruthy();
  });
});
