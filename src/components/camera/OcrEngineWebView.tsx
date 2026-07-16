import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

import { filterOcrNoise } from '@/utils/productForm/ocrNoiseFilter';
import type { OcrLineData } from '@/utils/productForm/ocrNoiseFilter';

// ─── Tesseract WebView HTML ───────────────────────────────────────────────────
//
// Inline document strategy:
//   1. Loads tesseract.js from CDN; signals OCR_ERROR if the CDN is unreachable.
//   2. Creates a persistent worker immediately so training data downloads
//      while the user is still framing/picking an image.
//   3. Exposes processImage(base64) called via injectJavaScript from RN.
//      Full-resolution photos are downscaled on a canvas first: Tesseract is
//      both slower and less accurate on 12MP frames than at ~1600px.
//   4. Posts typed messages back via window.ReactNativeWebView.postMessage.
//
const TESSERACT_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<script>
  var workerPromise = null;
  // Full-frame shots (no crop step) need more pixels per character than the
  // old cropped-region flow: at 1600px a tube's label text starves Tesseract
  // ("orange" -> "oran" on-device, 2026-07-16). 2400 keeps capital heights
  // in the engine's comfortable range at arm's-length framing.
  var MAX_DIMENSION = 2400;

  function postMsg(obj) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }
  }

  function loadTesseract() {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = function () {
      // eng+pol+fra: the target markets' Latin scripts. English-only
      // traineddata cannot see Polish/French diacritics at all — "tołpa"
      // was unrecognizable on-device until pol was added. Cyrillic (rus)
      // stays out for now: it needs market-based selection, not a blanket
      // fourth model on every scan.
      workerPromise = Tesseract.createWorker('eng+pol+fra', 1, { logger: function () {} });
      workerPromise
        .then(function () { postMsg({ type: 'WORKER_READY' }); })
        .catch(function (e) { postMsg({ type: 'OCR_ERROR', message: String(e) }); });
    };
    s.onerror = function () {
      postMsg({ type: 'OCR_ERROR', message: 'Could not load OCR engine. Check your internet connection.' });
    };
    document.head.appendChild(s);
  }

  // Downscales so the long edge is at most MAX_DIMENSION. Falls back to the
  // original on any decode failure — a full-size scan beats no scan.
  function downscale(dataUrl, cb) {
    var img = new Image();
    img.onload = function () {
      var longEdge = Math.max(img.width, img.height);
      if (longEdge <= MAX_DIMENSION) { cb(dataUrl); return; }
      var scale = MAX_DIMENSION / longEdge;
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      cb(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = function () { cb(dataUrl); };
    img.src = dataUrl;
  }

  // tesseract.js v5 removed the flat data.words/data.lines arrays: word data
  // now lives under blocks -> paragraphs -> lines -> words and must be
  // requested via the output argument. Older shapes are kept as fallbacks.
  // Returns null when no structured data is available, so the RN side can
  // fall back to the unfiltered text.
  function extractLines(data) {
    var rawLines = [];
    if (data.blocks && data.blocks.length) {
      data.blocks.forEach(function (b) {
        (b.paragraphs || []).forEach(function (p) {
          (p.lines || []).forEach(function (l) { rawLines.push(l); });
        });
      });
    } else if (data.lines && data.lines.length) {
      rawLines = data.lines;
    }
    if (!rawLines.length) return null;
    return rawLines.map(function (l) {
      return {
        words: (l.words || []).map(function (w) {
          return {
            text: w.text,
            confidence: w.confidence,
            x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1
          };
        }),
      };
    });
  }

  function processImage(base64) {
    if (!workerPromise) {
      postMsg({ type: 'OCR_ERROR', message: 'OCR engine is still loading — please try again in a moment.' });
      return;
    }
    var dataUrl = 'data:image/jpeg;base64,' + base64;
    downscale(dataUrl, function (scaledUrl) {
      workerPromise
        .then(function (worker) { return worker.recognize(scaledUrl, {}, { text: true, blocks: true }); })
        .then(function (result) {
          var lines = extractLines(result.data);
          // Flat word list kept for the FE-11 highlighting contract (additive,
          // no consumer yet); lines carry the same data plus confidence and
          // line grouping for the RN-side noise filter.
          var words = [];
          (lines || []).forEach(function (l) { l.words.forEach(function (w) { words.push(w); }); });
          postMsg({ type: 'OCR_RESULT', text: result.data.text, words: words, lines: lines });
        })
        .catch(function (e) { postMsg({ type: 'OCR_ERROR', message: String(e) }); });
    });
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
  /**
   * Per-line word data (with confidence) for the noise filter. null/absent
   * when the engine could not produce structured output — the raw text is
   * forwarded unfiltered in that case.
   */
  lines?: OcrLineData[] | null;
}

export interface OcrEngineHandle {
  /** Queues the image if the Tesseract worker isn't ready yet. */
  processImage(base64: string): void;
  /** Drops a queued image (e.g. when the host sheet/modal closes). */
  clearPending(): void;
}

export interface OcrEngineWebViewProps {
  /**
   * Recognized text after the confidence/geometry noise filter
   * (ocrNoiseFilter.ts); line breaks preserved. Empty string when nothing
   * was read — or when everything read was noise.
   */
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
        // With structured line data, forward only what survives the noise
        // filter. An empty filtered result means the scan was all garbage —
        // hosts already route empty text to their "try again / manual entry"
        // error path, which is the right destination for it (spec §6.1).
        if (msg.lines && msg.lines.length > 0) {
          const filtered = filterOcrNoise(msg.lines);
          if (__DEV__) {
            // QA visibility into what the engine saw vs what the filter kept:
            // every word with its confidence and pixel height.
            const dump = msg.lines
              .map((line) =>
                line.words
                  .map((w) => `${w.text}(${Math.round(w.confidence)},h${w.y1 - w.y0})`)
                  .join(' '),
              )
              .join('\n');
            console.warn(`[OCR] words(conf,height):\n${dump}\n[OCR] filtered:\n${filtered}`);
          }
          onResult(filtered);
        } else {
          if (__DEV__) {
            console.warn(`[OCR] no structured lines; raw text passthrough:\n${msg.text ?? ''}`);
          }
          onResult(msg.text ?? '');
        }
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
