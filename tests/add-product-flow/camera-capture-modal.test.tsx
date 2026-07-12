/**
 * Component tests — CameraCaptureModal, barcode mode (camera-and-form-fixes
 * Steps 1–2). Native camera/picker/WebView modules are mocked at the module
 * boundary; the manual-entry validation itself is unit-tested in
 * src/utils/productForm/barcodeValidation.test.ts.
 * Key guarantees:
 *  - the close button always fires onClose;
 *  - manual barcode entry is available immediately, validates inline, and
 *    exits through onCapture exactly like a live decode;
 *  - the "way out" hint appears after prolonged unsuccessful scanning.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text: RNText } = require('react-native');
  return {
    Feather: ({ name }: { name: string }) => <RNText>{`icon-${name}`}</RNText>,
  };
});

jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  return {
    CameraView: () => <View testID="camera-view" />,
    useCameraPermissions: () => [
      { granted: true, canAskAgain: true },
      jest.fn(),
    ],
  };
});

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('@/components/camera/OcrEngineWebView', () => {
  const React = require('react');
  return {
    OcrEngineWebView: React.forwardRef(() => null),
  };
});

import { CameraCaptureModal } from '@/components/camera/CameraCaptureModal';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CameraCaptureModal — barcode mode', () => {
  it('fires onClose from the close button while the scanner is active', () => {
    const onClose = jest.fn();
    render(
      <CameraCaptureModal mode="barcode" visible onClose={onClose} onCapture={jest.fn()} />,
    );

    fireEvent.press(screen.getByLabelText('Close camera'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers manual entry immediately, not only after a failed scan', () => {
    render(
      <CameraCaptureModal mode="barcode" visible onClose={jest.fn()} onCapture={jest.fn()} />,
    );

    expect(screen.getByText("Can't scan? Enter the barcode manually.")).toBeTruthy();
    expect(screen.getByLabelText('Barcode digits')).toBeTruthy();
  });

  it('shows an inline error for invalid digits and does not capture', () => {
    const onCapture = jest.fn();
    render(
      <CameraCaptureModal mode="barcode" visible onClose={jest.fn()} onCapture={onCapture} />,
    );

    fireEvent.changeText(screen.getByLabelText('Barcode digits'), '12345');
    fireEvent.press(screen.getByText('Use this barcode'));

    expect(screen.getByText('A barcode has 12 or 13 digits')).toBeTruthy();
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('captures a valid 12-digit UPC-A normalized to its 13-digit EAN form', () => {
    const onCapture = jest.fn();
    render(
      <CameraCaptureModal mode="barcode" visible onClose={jest.fn()} onCapture={onCapture} />,
    );

    fireEvent.changeText(screen.getByLabelText('Barcode digits'), '036000291452');
    fireEvent.press(screen.getByText('Use this barcode'));

    expect(onCapture).toHaveBeenCalledWith({ mode: 'barcode', code: '0036000291452' });
  });

  it('clears the inline error as soon as the user edits the digits', () => {
    render(
      <CameraCaptureModal mode="barcode" visible onClose={jest.fn()} onCapture={jest.fn()} />,
    );

    fireEvent.changeText(screen.getByLabelText('Barcode digits'), '12345');
    fireEvent.press(screen.getByText('Use this barcode'));
    fireEvent.changeText(screen.getByLabelText('Barcode digits'), '123456');

    expect(screen.queryByText('A barcode has 12 or 13 digits')).toBeNull();
  });

  it('shows the trouble hint only after prolonged unsuccessful scanning', () => {
    jest.useFakeTimers();
    try {
      render(
        <CameraCaptureModal mode="barcode" visible onClose={jest.fn()} onCapture={jest.fn()} />,
      );

      expect(screen.queryByText(/Having trouble scanning/)).toBeNull();

      act(() => {
        jest.advanceTimersByTime(9_100);
      });

      expect(screen.getByText(/Having trouble scanning/)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});
