import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

// ─── Tesseract WebView HTML ───────────────────────────────────────────────────
//
// Inline document strategy:
//   1. Loads tesseract.js from CDN; signals OCR_ERROR if the CDN is unreachable.
//   2. Creates a persistent worker immediately so training data downloads
//      while the user is still framing/picking an image.
//   3. Exposes processImage(base64) called via injectJavaScript from RN.
//   4. Posts typed messages back via window.ReactNativeWebView.postMessage.
//
const TESSERACT_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<script>
  var workerPromise = null;

  function postMsg(obj) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }
  }

  function loadTesseract() {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = function () {
      workerPromise = Tesseract.createWorker('eng', 1, { logger: function () {} });
      workerPromise
        .then(function () { postMsg({ type: 'WORKER_READY' }); })
        .catch(function (e) { postMsg({ type: 'OCR_ERROR', message: String(e) }); });
    };
    s.onerror = function () {
      postMsg({ type: 'OCR_ERROR', message: 'Could not load OCR engine. Check your internet connection.' });
    };
    document.head.appendChild(s);
  }

  function processImage(base64) {
    if (!workerPromise) {
      postMsg({ type: 'OCR_ERROR', message: 'OCR engine is still loading — please try again in a moment.' });
      return;
    }
    var dataUrl = 'data:image/jpeg;base64,' + base64;
    workerPromise
      .then(function (worker) { return worker.recognize(dataUrl); })
      .then(function (result) {
        // Word-level bounding boxes tesseract.js already computes internally.
        // Captured here for a future highlighting overlay (FE-11 Story 2,
        // currently BLOCKED on a storage-policy decision) — not persisted or
        // consumed by any UI yet; purely additive to the message payload.
        var words = (result.data.words || []).map(function (w) {
          return { text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 };
        });
        postMsg({ type: 'OCR_RESULT', text: result.data.text, words: words });
      })
      .catch(function (e) { postMsg({ type: 'OCR_ERROR', message: String(e) }); });
  }

  loadTesseract();
</script>
</body>
</html>`;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Word-level OCR bounding box, in the source image's pixel coordinates. */
interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface WebViewMsg {
  type: 'WORKER_READY' | 'OCR_RESULT' | 'OCR_ERROR';
  text?: string;
  message?: string;
  /**
   * Captured for a future label-photo highlighting overlay (FE-11 Story 2,
   * BLOCKED pending a storage-policy decision — see
   * docs/specs/inci-attribution-highlighting.md). Not persisted or consumed
   * anywhere yet; reading it here is purely additive and must never change
   * the existing text-only OCR flow's behavior.
   */
  words?: OcrWord[];
}

export interface OcrEngineHandle {
  /** Queues the image if the Tesseract worker isn't ready yet. */
  processImage(base64: string): void;
  /** Drops a queued image (e.g. when the host sheet/modal closes). */
  clearPending(): void;
}

export interface OcrEngineWebViewProps {
  /** Raw recognized text, uncleaned. Empty string when nothing was read. */
  onResult: (rawText: string) => void;
  onError: (message: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * The single shared Tesseract OCR engine: a hidden WebView the host keeps
 * mounted for as long as OCR may be needed (unmounting destroys the worker
 * and forces a fresh CDN download). Hosts: OcrScannerSheet (photo-picker
 * flow) and CameraCaptureModal (viewfinder flow). Do not fork this.
 */
export const OcrEngineWebView = forwardRef<OcrEngineHandle, OcrEngineWebViewProps>(
  function OcrEngineWebView({ onResult, onError }, ref) {
    const webviewRef = useRef<WebView>(null);
    // useRef instead of useState — callers may hold callbacks that close over
    // this; a ref always reads current readiness (WORKER_READY fires once).
    const workerReadyRef = useRef(false);
    // Holds a base64 string when an image arrives before the worker is ready.
    const pendingBase64 = useRef<string | null>(null);

    function injectImage(base64: string) {
      webviewRef.current?.injectJavaScript(`processImage(${JSON.stringify(base64)}); true;`);
    }

    useImperativeHandle(ref, () => ({
      processImage(base64: string) {
        if (workerReadyRef.current) {
          injectImage(base64);
        } else {
          pendingBase64.current = base64;
        }
      },
      clearPending() {
        pendingBase64.current = null;
      },
    }));

    function handleMessage(event: WebViewMessageEvent) {
      let msg: WebViewMsg;
      try {
        msg = JSON.parse(event.nativeEvent.data) as WebViewMsg;
      } catch {
        onError('Unreadable OCR message');
        return;
      }

      if (msg.type === 'WORKER_READY') {
        workerReadyRef.current = true;
        if (pendingBase64.current) {
          injectImage(pendingBase64.current);
          pendingBase64.current = null;
        }
        return;
      }

      if (msg.type === 'OCR_RESULT') {
        onResult(msg.text ?? '');
        return;
      }

      // OCR_ERROR or any unrecognised message type
      onError(msg.message ?? 'OCR failed');
    }

    return (
      <View style={styles.hiddenWebView}>
        <WebView
          ref={webviewRef}
          source={{ html: TESSERACT_HTML }}
          onMessage={handleMessage}
          onError={() => onError('OCR engine crashed')}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
        />
      </View>
    );
  },
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Off-screen but with real dimensions: WKWebView (iOS) silently stops
  // executing JavaScript when width/height approach zero. 100×100 is the
  // minimum safe size confirmed to keep the JS engine running.
  // pointerEvents omitted — the view is already unreachable at (-2000, -2000).
  hiddenWebView: {
    position: 'absolute',
    top: -2000,
    left: -2000,
    width: 100,
    height: 100,
    opacity: 0,
  },
});
