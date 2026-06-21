import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { ocrTextCleaner } from '@/utils/ocrTextCleaner';
import { colors, radius, space, typography } from '@/constants/tokens';

// ─── Tesseract WebView HTML ───────────────────────────────────────────────────
//
// Inline document strategy:
//   1. Loads tesseract.js from CDN; signals OCR_ERROR if the CDN is unreachable.
//   2. Creates a persistent worker immediately so training data downloads
//      while the user is interacting with the image picker.
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
      .then(function (result) { postMsg({ type: 'OCR_RESULT', text: result.data.text }); })
      .catch(function (e) { postMsg({ type: 'OCR_ERROR', message: String(e) }); });
  }

  loadTesseract();
</script>
</body>
</html>`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OcrScannerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the cleaned INCI string once OCR succeeds. */
  onResult: (text: string) => void;
}

interface WebViewMsg {
  type: 'WORKER_READY' | 'OCR_RESULT' | 'OCR_ERROR';
  text?: string;
  message?: string;
}

const SCAN_TIMEOUT_MS = 10_000;

// ─── Component ────────────────────────────────────────────────────────────────

export function OcrScannerSheet({ visible, onClose, onResult }: OcrScannerSheetProps) {
  // `loading` drives the full-screen overlay. Set to true the instant the
  // user hands us an image — before any WebView work starts.
  const [loading, setLoading] = useState(false);

  const webviewRef = useRef<WebView>(null);
  // Holds a base64 string when the image arrives before the worker is ready.
  const pendingBase64 = useRef<string | null>(null);
  // Fail-safe: if loading stays true for >10s we auto-reset and surface an error.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // useRef instead of useState — alert callbacks close over this ref and always
  // read the current value. With useState the alert's captured closure would see
  // the stale workerReady=false even if WORKER_READY fired while the picker was open,
  // causing the pending image to sit in pendingBase64 forever (WORKER_READY won't
  // fire a second time).
  const workerReadyRef = useRef(false);

  // ── Timeout helpers ────────────────────────────────────────────────────────

  function clearScanTimeout() {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function startScanTimeout() {
    clearScanTimeout();
    console.log('[OCR] ⏱ Timeout started (10 s)');
    timeoutRef.current = setTimeout(() => {
      console.log('[OCR] ⏱ TIMEOUT — 10 s elapsed with no result; resetting state');
      setLoading(false);
      // Must call onClose so showOcrScanner resets to false in the parent.
      // Without this the scan button becomes permanently unresponsive because
      // setShowOcrScanner(true) is a no-op when it is already true, meaning
      // the useEffect for `visible` never re-fires and no picker alert appears.
      Alert.alert('Error', 'Scanner timed out. Please try again.', [
        { text: 'OK', onPress: onClose },
      ]);
    }, SCAN_TIMEOUT_MS);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!visible) {
      console.log('[OCR] visible → false: clearing timeout and resetting loading state');
      clearScanTimeout();
      setLoading(false);
      // workerReadyRef intentionally NOT reset: the WebView is NOT unmounted when
      // visible toggles, so the Tesseract worker is still alive. Resetting it would
      // cause pendingBase64 to accumulate on the next open with no way to flush it.
      pendingBase64.current = null;
      return;
    }

    console.log('[OCR] visible → true: opening picker alert');
    showPickerAlert();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Clear the timeout if the component is unmounted while a scan is in progress.
  useEffect(() => () => clearScanTimeout(), []);

  // ── Picker ─────────────────────────────────────────────────────────────────

  function showPickerAlert() {
    console.log('[OCR] Alert.alert shown (Take Photo / Gallery / Cancel)');
    Alert.alert(
      'Scan Ingredient Label',
      undefined,
      [
        { text: 'Take Photo', onPress: handleCamera },
        { text: 'Choose from Gallery', onPress: handleGallery },
        { text: 'Cancel', style: 'cancel', onPress: onClose },
      ],
    );
  }

  async function handleCamera() {
    console.log('[OCR] User tapped "Take Photo" — requesting camera permission');
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    console.log('[OCR] Camera permission result:', granted ? 'GRANTED' : 'DENIED');
    if (!granted) {
      Alert.alert(
        'Camera Access Needed',
        'Enable camera access in Settings to take a photo of the label.',
        [{ text: 'OK', onPress: onClose }],
      );
      return;
    }
    console.log('[OCR] Launching camera (launchCameraAsync)');
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      base64: true,
      allowsEditing: true,
    });
    console.log(
      '[OCR] launchCameraAsync result — canceled:', result.canceled,
      '| base64 present:', !!result.assets?.[0]?.base64,
      '| base64 length:', result.assets?.[0]?.base64?.length ?? 0,
    );
    if (result.canceled) {
      console.log('[OCR] Camera canceled — calling onClose()');
      onClose();
      return;
    }
    handlePickedImage(result.assets[0]?.base64 ?? null);
  }

  async function handleGallery() {
    console.log('[OCR] User tapped "Choose from Gallery" — requesting media library permission');
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('[OCR] Media library permission result:', granted ? 'GRANTED' : 'DENIED');
    if (!granted) {
      Alert.alert(
        'Photo Access Needed',
        'Enable photo library access in Settings > Vials to choose an image.',
        [{ text: 'OK', onPress: onClose }],
      );
      return;
    }
    console.log('[OCR] Launching image library (launchImageLibraryAsync)');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
      allowsEditing: true,
    });
    console.log(
      '[OCR] launchImageLibraryAsync result — canceled:', result.canceled,
      '| base64 present:', !!result.assets?.[0]?.base64,
      '| base64 length:', result.assets?.[0]?.base64?.length ?? 0,
    );
    if (result.canceled) {
      console.log('[OCR] Gallery canceled — calling onClose()');
      onClose();
      return;
    }
    handlePickedImage(result.assets[0]?.base64 ?? null);
  }

  // ── OCR pipeline ──────────────────────────────────────────────────────────

  function handlePickedImage(base64: string | null | undefined) {
    console.log('[OCR] handlePickedImage — base64 length:', base64?.length ?? 'null/undefined');
    if (!base64) {
      console.log('[OCR] No base64 data received — closing');
      onClose();
      return;
    }

    // ▶ Show the loading overlay IMMEDIATELY, before any WebView work.
    console.log('[OCR] Calling setLoading(true) — spinner Modal should render NOW');
    setLoading(true);
    startScanTimeout();

    // Read from ref, not state — this function may have been captured in an Alert
    // callback before workerReady changed, so a state variable would be stale here.
    if (workerReadyRef.current) {
      console.log('[OCR] Worker is ready (ref=true) — calling injectImage() immediately');
      injectImage(base64);
    } else {
      console.log('[OCR] Worker not ready yet (ref=false) — storing base64 in pendingBase64 ref');
      pendingBase64.current = base64;
    }
  }

  function injectImage(base64: string) {
    console.log('[OCR] injectJavaScript("processImage(...)") — base64 length:', base64.length);
    webviewRef.current?.injectJavaScript(`processImage(${JSON.stringify(base64)}); true;`);
  }

  function handleWebViewMessage(event: WebViewMessageEvent) {
    const raw = event.nativeEvent.data;
    console.log('[OCR] onMessage from WebView — raw (first 120 chars):', raw.slice(0, 120));

    let msg: WebViewMsg;
    try {
      msg = JSON.parse(raw) as WebViewMsg;
    } catch (err) {
      console.log('[OCR] JSON.parse failed on WebView message — err:', err);
      showOcrError();
      return;
    }

    console.log('[OCR] Parsed message type:', msg.type);

    if (msg.type === 'WORKER_READY') {
      console.log('[OCR] WORKER_READY received — setting workerReadyRef.current = true');
      workerReadyRef.current = true;
      if (pendingBase64.current) {
        console.log('[OCR] Pending base64 exists — injecting now');
        injectImage(pendingBase64.current);
        pendingBase64.current = null;
      } else {
        console.log('[OCR] No pending base64 — waiting for user to pick an image');
      }
      return;
    }

    if (msg.type === 'OCR_RESULT') {
      console.log('[OCR] OCR_RESULT received — raw text length:', msg.text?.length ?? 0);
      clearScanTimeout();
      const { cleanedText, hadNonLatin } = ocrTextCleaner(msg.text ?? '');
      console.log('[OCR] ocrTextCleaner output — cleaned length:', cleanedText.length, '| hadNonLatin:', hadNonLatin);
      if (!cleanedText.trim()) {
        console.log('[OCR] Cleaned text is empty — showing OCR error');
        showOcrError();
        return;
      }
      console.log('[OCR] Success — calling setLoading(false) and delivering result');
      setLoading(false);
      if (hadNonLatin) {
        Alert.alert(
          'Some Characters Removed',
          'Many non-Latin characters were stripped from the scan. Check the ingredient list looks correct.',
          [{ text: 'OK', onPress: () => onResult(cleanedText) }],
        );
      } else {
        onResult(cleanedText);
      }
      return;
    }

    // OCR_ERROR or any unrecognised message type
    console.log('[OCR] OCR_ERROR (or unknown type):', msg.type, '— message:', msg.message);
    showOcrError();
  }

  function handleWebViewError() {
    // Always surface the error — showOcrError is idempotent (no-ops if not loading).
    // Guarding on `loading` here would capture a stale closure value and silently
    // skip the error dialog if the WebView crashes after a timeout already reset state.
    console.log('[OCR] WebView onError fired');
    showOcrError();
  }

  function showOcrError() {
    console.log('[OCR] showOcrError() — clearing timeout, setLoading(false)');
    clearScanTimeout();
    setLoading(false);
    Alert.alert(
      'Could Not Read Text',
      'Try better lighting, hold the camera steady, or type the ingredients manually.',
      [{ text: 'OK', onPress: onClose }],
    );
  }

  function handleCancelPress() {
    console.log('[OCR] User pressed Cancel during loading — resetting');
    clearScanTimeout();
    setLoading(false);
    pendingBase64.current = null;
    onClose();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // The WebView is ALWAYS kept mounted while `visible` is true — it must never
  // be placed inside the loading Modal or it would unmount/remount on each
  // toggle, destroying the Tesseract worker and forcing a fresh CDN download.
  if (!visible) return null;

  return (
    <>
      {/*
        Hidden WebView: positioned far off-screen with explicit non-zero size.
        Using `display: none` or zero dimensions would stop JS execution on
        some platforms, so we keep it rendered but invisible and non-interactive.
      */}
      <View style={styles.hiddenWebView}>
        <WebView
          ref={webviewRef}
          source={{ html: TESSERACT_HTML }}
          onMessage={handleWebViewMessage}
          onError={handleWebViewError}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
        />
      </View>

      {/*
        Loading overlay Modal.
        `statusBarTranslucent` is required on Android to render above the
        status bar when the parent sheet already occupies the full screen.
        `visible` is driven by the `loading` boolean — set synchronously in
        handlePickedImage before any async work, so it renders before the
        WebView ever touches the image.
      */}
      <Modal
        visible={loading}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <ActivityIndicator size="large" color={colors.textPrimary} style={styles.spinner} />
            <Text style={styles.cardTitle}>Processing photo…</Text>
            <Text style={styles.cardSub}>This may take 10–20 seconds</Text>
            <Pressable
              onPress={handleCancelPress}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Cancel OCR processing"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.gutterScreen,
  },
  card: {
    backgroundColor: colors.bgBase,
    borderRadius: radius.xl,
    paddingHorizontal: space[6],
    paddingTop: space[8],
    paddingBottom: space[5],
    width: '100%',
    alignItems: 'center',
    gap: space[2],
  },
  spinner: {
    marginBottom: space[2],
  },
  cardTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  cardSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: space[4],
    paddingHorizontal: space[6],
    paddingVertical: space[2] + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  cancelBtnPressed: {
    backgroundColor: colors.borderDivider,
  },
  cancelText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
});
