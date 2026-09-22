/**
 * Component tests — CameraCaptureModal, `sourceImageUri` (label mode).
 * Covers the "Read label" path: OCR runs on an ALREADY-CAPTURED photo (the
 * product cover) instead of launching the camera/gallery — added so taking a
 * cover photo never forces a second shot just to read the label.
 * Key guarantees:
 *  - when `sourceImageUri` is set, the camera/gallery pickers are never
 *    launched — the existing file is read and OCR'd in place;
 *  - a successful read reaches `onCapture` exactly like a fresh capture would;
 *  - on OCR failure, "Try Again" re-reads the SAME photo, not a new one.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

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
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

// Module-scoped so tests can drive base64() per-case (resolve/reject) and
// assert on the constructor call (which URI was read). The outer `mock*`
// variables are only dereferenced INSIDE the nested implementation callback
// below (deferred to call time) — jest.mock() factories are hoisted above
// module-level `const`s, so referencing an outer const directly in the
// factory's own returned object would capture it before it's assigned.
const mockFileCtor = jest.fn();
const mockBase64 = jest.fn();

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => {
    mockFileCtor(uri);
    return { uri, base64: mockBase64 };
  }),
}));

// State lives inside the factory (module-body vars are unreliable in hoisted
// factories); the engine ref exposes processImage/clearPending and the test
// reaches back the onResult/onError callbacks via __state to simulate the
// engine finishing.
jest.mock('@/components/camera/OcrEngineWebView', () => {
  const React = require('react');
  const state: {
    onResult: ((text: string) => void) | null;
    onError: ((message: string) => void) | null;
    processImage: jest.Mock;
  } = { onResult: null, onError: null, processImage: jest.fn() };

  const OcrEngineWebView = React.forwardRef(
    (props: { onResult: (t: string) => void; onError: (m: string) => void }, ref: unknown) => {
      state.onResult = props.onResult;
      state.onError = props.onError;
      React.useImperativeHandle(ref, () => ({
        processImage: state.processImage,
        clearPending: jest.fn(),
      }));
      return null;
    },
  );

  return { OcrEngineWebView, __state: state };
});

import * as ImagePicker from 'expo-image-picker';

import { CameraCaptureModal } from '@/components/camera/CameraCaptureModal';

const engineMock = jest.requireMock('@/components/camera/OcrEngineWebView') as {
  __state: {
    onResult: ((text: string) => void) | null;
    onError: ((message: string) => void) | null;
    processImage: jest.Mock;
  };
};

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;

beforeEach(() => {
  jest.clearAllMocks();
  mockBase64.mockResolvedValue('BASE64_BYTES');
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('CameraCaptureModal — sourceImageUri (existing-photo OCR)', () => {
  it('reads the given file instead of launching the camera or gallery', async () => {
    render(
      <CameraCaptureModal
        mode="label"
        visible
        sourceImageUri="file:///cover.jpg"
        onClose={jest.fn()}
        onCapture={jest.fn()}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFileCtor).toHaveBeenCalledWith('file:///cover.jpg');
    expect(mockBase64).toHaveBeenCalledTimes(1);
    expect(engineMock.__state.processImage).toHaveBeenCalledWith('BASE64_BYTES');
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('forwards a successful OCR read to onCapture as a label result', async () => {
    const onCapture = jest.fn();
    render(
      <CameraCaptureModal
        mode="label"
        visible
        sourceImageUri="file:///cover.jpg"
        onClose={jest.fn()}
        onCapture={onCapture}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      engineMock.__state.onResult?.('BIODERMA\nAtoderm Ultra');
    });

    expect(onCapture).toHaveBeenCalledWith({
      mode: 'label',
      rawText: 'BIODERMA\nAtoderm Ultra',
      sourceUri: 'file:///cover.jpg',
    });
  });

  it('re-reads the SAME photo on "Try Again" after a failed read, without opening a picker', async () => {
    mockBase64.mockRejectedValueOnce(new Error('unreadable'));
    render(
      <CameraCaptureModal
        mode="label"
        visible
        sourceImageUri="file:///cover.jpg"
        onClose={jest.fn()}
        onCapture={jest.fn()}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Scan Failed',
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ text: 'Try Again' })]),
    );

    mockBase64.mockResolvedValueOnce('BASE64_BYTES_RETRY');
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const tryAgainButton = alertCall[2].find((b: { text: string }) => b.text === 'Try Again');

    await act(async () => {
      tryAgainButton.onPress();
      await Promise.resolve();
    });

    expect(mockFileCtor).toHaveBeenCalledTimes(2);
    expect(mockFileCtor).toHaveBeenLastCalledWith('file:///cover.jpg');
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('shows the OCR failure alert when the engine itself reports an error', async () => {
    render(
      <CameraCaptureModal
        mode="label"
        visible
        sourceImageUri="file:///cover.jpg"
        onClose={jest.fn()}
        onCapture={jest.fn()}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      engineMock.__state.onError?.('engine crashed');
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Scan Failed',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('falls back to the Take Photo / Choose from Gallery prompt when sourceImageUri is absent', async () => {
    render(
      <CameraCaptureModal mode="label" visible onClose={jest.fn()} onCapture={jest.fn()} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFileCtor).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Scan Front Label',
      undefined,
      expect.any(Array),
    );
  });
});
