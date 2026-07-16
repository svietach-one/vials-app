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
import * as ImagePicker from 'expo-image-picker';
import { OcrEngineWebView } from '@/components/camera/OcrEngineWebView';
import type { OcrEngineHandle } from '@/components/camera/OcrEngineWebView';
import { ocrTextCleaner } from '@/utils/ocrTextCleaner';
import { colors, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OcrScannerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the cleaned INCI string once OCR succeeds. */
  onResult: (text: string) => void;
}

const SCAN_TIMEOUT_MS = 10_000;
/** High JPEG quality: 0.5 compression on small INCI print measurably hurt
 *  Tesseract (same constant as CameraCaptureModal's OCR flow). */
const PHOTO_QUALITY = 0.85;

// ─── Component ────────────────────────────────────────────────────────────────

export function OcrScannerSheet({ visible, onClose, onResult }: OcrScannerSheetProps) {
  // `loading` drives the full-screen overlay. Set to true the instant the
  // user hands us an image — before any OCR work starts.
  const [loading, setLoading] = useState(false);

  // The shared Tesseract engine (hidden WebView) buffers images internally
  // until its worker is ready, so this sheet only ever calls processImage.
  const engineRef = useRef<OcrEngineHandle>(null);
  // Fail-safe: if loading stays true for >10s we auto-reset and surface an error.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Timeout helpers ────────────────────────────────────────────────────────

  function clearScanTimeout() {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function startScanTimeout() {
    clearScanTimeout();
    timeoutRef.current = setTimeout(() => {
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
      clearScanTimeout();
      setLoading(false);
      // The engine's worker readiness survives visibility toggles (the WebView
      // is NOT unmounted); only a queued image must be dropped.
      engineRef.current?.clearPending();
      return;
    }

    showPickerAlert();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Clear the timeout if the component is unmounted while a scan is in progress.
  useEffect(() => () => clearScanTimeout(), []);

  // ── Picker ─────────────────────────────────────────────────────────────────

  function showPickerAlert() {
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
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Camera Access Needed',
        'Enable camera access in Settings to take a photo of the label.',
        [{ text: 'OK', onPress: onClose }],
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: PHOTO_QUALITY,
      base64: true,
    });
    if (result.canceled) {
      onClose();
      return;
    }
    handlePickedImage(result.assets[0]?.base64 ?? null);
  }

  async function handleGallery() {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Photo Access Needed',
        'Enable photo library access in Settings > Vials to choose an image.',
        [{ text: 'OK', onPress: onClose }],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: PHOTO_QUALITY,
      base64: true,
    });
    if (result.canceled) {
      onClose();
      return;
    }
    handlePickedImage(result.assets[0]?.base64 ?? null);
  }

  // ── OCR pipeline ──────────────────────────────────────────────────────────

  function handlePickedImage(base64: string | null | undefined) {
    if (!base64) {
      onClose();
      return;
    }

    // ▶ Show the loading overlay IMMEDIATELY, before any OCR work.
    setLoading(true);
    startScanTimeout();
    engineRef.current?.processImage(base64);
  }

  function handleOcrText(rawText: string) {
    clearScanTimeout();
    const { cleanedText, hadNonLatin } = ocrTextCleaner(rawText);
    if (!cleanedText.trim()) {
      showOcrError();
      return;
    }
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
  }

  function showOcrError() {
    clearScanTimeout();
    setLoading(false);
    Alert.alert(
      'Could Not Read Text',
      'Try better lighting, hold the camera steady, or type the ingredients manually.',
      [{ text: 'OK', onPress: onClose }],
    );
  }

  function handleCancelPress() {
    clearScanTimeout();
    setLoading(false);
    engineRef.current?.clearPending();
    onClose();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // The engine WebView is ALWAYS kept mounted while `visible` is true — it
  // must never be placed inside the loading Modal or it would unmount/remount
  // on each toggle, destroying the Tesseract worker and forcing a fresh CDN
  // download.
  if (!visible) return null;

  return (
    <>
      <OcrEngineWebView
        ref={engineRef}
        onResult={handleOcrText}
        // Always surface the error — showOcrError is idempotent (no-ops if not
        // loading). Guarding on `loading` here would capture a stale closure
        // value and silently skip the error dialog if the WebView crashes after
        // a timeout already reset state.
        onError={showOcrError}
      />

      {/*
        Loading overlay Modal.
        `statusBarTranslucent` is required on Android to render above the
        status bar when the parent sheet already occupies the full screen.
        `visible` is driven by the `loading` boolean — set synchronously in
        handlePickedImage before any async work, so it renders before the
        engine ever touches the image.
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
