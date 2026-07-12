/**
 * Component tests — IngredientsSection + BarcodeSection (tasks 05/07, QA task 10).
 * Key guarantees:
 *  - the INCI camera is unreachable except through InciScanNotice, and the
 *    notice reappears on every tap (no persisted dismissal);
 *  - "Use manual checklist instead" never opens the camera;
 *  - zero actives is rendered as a neutral, valid state;
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
// that renders only when the section actually sets it visible.
jest.mock('@/components/camera/CameraCaptureModal', () => {
  const { Text: RNText } = require('react-native');
  return {
    CameraCaptureModal: ({ visible, mode }: { visible: boolean; mode: string }) =>
      visible ? <RNText>{`camera-open-${mode}`}</RNText> : null,
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
