/**
 * Regression test — FE-7 (OCR word-capture, additive-only message contract).
 * Spec: docs/specs/inci-attribution-highlighting.md §6 ("New data — OCR word
 * coordinates") + Non-Goals (no persistence, no Story 2 UI).
 * Tech design: docs/tech-design/inci-attribution-highlighting.md FE-7.
 *
 * FE-7 extends the WebView -> RN `OCR_RESULT` message to additionally include
 * `words` (bounding boxes), read but NOT persisted or wired to any UI. This
 * suite asserts the change is purely additive: the existing text-only OCR flow
 * (consumed today by ManualProductFormScreen.handleOcrResult, which only ever
 * reads the returned `text`) must keep working identically whether or not a
 * `words` array is present on the message payload.
 *
 * Out of scope: any assertion on `words` being stored, forwarded to a screen,
 * or used for highlighting — Story 2 is BLOCKED and has no consumer yet.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render } from '@testing-library/react-native';

// Capture the WebView's onMessage handler so the test can simulate a message
// from the (mocked-out) tesseract.js worker without needing a real WebView.
const mockWebViewOnMessageRef: { current: ((event: { nativeEvent: { data: string } }) => void) | null } = {
  current: null,
};

jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => {
      mockWebViewOnMessageRef.current = props.onMessage;
      return <View testID="mock-webview" />;
    },
  };
});

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: false })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

import { OcrScannerSheet } from '@/components/product/OcrScannerSheet';

function simulateOcrResultMessage(payload: Record<string, unknown>) {
  mockWebViewOnMessageRef.current?.({
    nativeEvent: { data: JSON.stringify(payload) },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWebViewOnMessageRef.current = null;
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('FE-7 regression — existing OCR_RESULT text flow is unaffected by the added words field', () => {
  it('calls onResult with the cleaned text when the message has no words field (pre-FE-7 shape)', () => {
    const onResult = jest.fn();
    render(<OcrScannerSheet visible onClose={jest.fn()} onResult={onResult} />);

    simulateOcrResultMessage({ type: 'OCR_RESULT', text: 'Water, Niacinamide, Betaine Salicylate' });

    expect(onResult).toHaveBeenCalledWith('Water, Niacinamide, Betaine Salicylate');
  });

  it('calls onResult identically when the message additionally includes a words array (post-FE-7 shape)', () => {
    const onResult = jest.fn();
    render(<OcrScannerSheet visible onClose={jest.fn()} onResult={onResult} />);

    simulateOcrResultMessage({
      type: 'OCR_RESULT',
      text: 'Water, Niacinamide, Betaine Salicylate',
      words: [
        { text: 'Water', x0: 10, y0: 10, x1: 40, y1: 20 },
        { text: 'Niacinamide', x0: 45, y0: 10, x1: 100, y1: 20 },
      ],
    });

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('Water, Niacinamide, Betaine Salicylate');
  });

  it('does not throw and still surfaces the OCR error path when words is present but text is empty', () => {
    const onResult = jest.fn();
    const onClose = jest.fn();
    render(<OcrScannerSheet visible onClose={onClose} onResult={onResult} />);

    expect(() =>
      simulateOcrResultMessage({ type: 'OCR_RESULT', text: '', words: [] }),
    ).not.toThrow();

    expect(onResult).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Could Not Read Text',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('does not call onResult for a WORKER_READY message carrying no words/text (unrelated message type)', () => {
    const onResult = jest.fn();
    render(<OcrScannerSheet visible onClose={jest.fn()} onResult={onResult} />);

    simulateOcrResultMessage({ type: 'WORKER_READY' });

    expect(onResult).not.toHaveBeenCalled();
  });
});
