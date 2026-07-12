import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { OcrEngineWebView } from '@/components/camera/OcrEngineWebView';
import type { OcrEngineHandle } from '@/components/camera/OcrEngineWebView';
import { palette, radius, space, typography } from '@/constants/tokens';
import type { CaptureMode, CaptureResult } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CameraCaptureModalProps {
  mode: CaptureMode; // 'label' | 'barcode' | 'inci'
  visible: boolean;
  onClose: () => void;
  onCapture: (result: CaptureResult) => void;
}

const HELPER_COPY: Record<CaptureMode, string> = {
  label: 'Focus camera on the brand and product name',
  barcode: 'Point at the barcode on the box',
  inci: 'Align the ingredients list inside the frame',
};

const OCR_TIMEOUT_MS = 10_000;

// ─── Pulsing "Reading…" indicator ─────────────────────────────────────────────

function ReadingIndicator() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.readingWrap}>
      <Animated.View style={[styles.readingDot, { opacity: pulse }]} />
      <Text style={styles.readingLabel}>Reading…</Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * The single reusable full-screen capture modal for the Add Product flow.
 * `mode` selects the pipeline: live barcode decoding, or photo → shared
 * Tesseract OCR engine for label/INCI text. Data leaves ONLY through
 * `onCapture` — this component never touches the form reducer.
 *
 * Note: the codebase has no live text-frame OCR pipeline (OCR is photo-based
 * Tesseract in a WebView, shared with OcrScannerSheet), so label/inci modes
 * use a shutter button instead of continuous stable-block detection.
 */
export function CameraCaptureModal({ mode, visible, onClose, onCapture }: CameraCaptureModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFailed, setCameraFailed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ocrFailed, setOcrFailed] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const engineRef = useRef<OcrEngineHandle>(null);
  // Cooldown so a decoded barcode fires onCapture exactly once per open.
  const locked = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOcrMode = mode === 'label' || mode === 'inci';

  function clearOcrTimeout() {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  useEffect(() => {
    if (!visible) return;
    // Fresh state on every open.
    locked.current = false;
    setProcessing(false);
    setOcrFailed(false);
    setCameraFailed(false);
  }, [visible]);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  // Clear the timeout if the component unmounts mid-scan.
  useEffect(() => () => clearOcrTimeout(), []);

  // ── Barcode pipeline ───────────────────────────────────────────────────────
  // Bound only in barcode mode (mode is fixed for the lifetime of an open
  // modal, so this never toggles mid-session); the lock ref guarantees a
  // single onCapture per open.

  const handleBarcodeScan = useCallback(
    ({ data }: { data: string }) => {
      if (locked.current || mode !== 'barcode') return;
      locked.current = true;
      onCapture({ mode: 'barcode', code: data });
    },
    [mode, onCapture],
  );

  // ── OCR pipeline (label / inci) ────────────────────────────────────────────

  async function handleShutter() {
    if (processing || locked.current) return;
    setOcrFailed(false);
    setProcessing(true);
    clearOcrTimeout();
    timeoutRef.current = setTimeout(handleOcrError, OCR_TIMEOUT_MS);

    try {
      const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.5 });
      if (!photo?.base64) {
        handleOcrError();
        return;
      }
      engineRef.current?.processImage(photo.base64);
    } catch {
      handleOcrError();
    }
  }

  function handleOcrText(rawText: string) {
    clearOcrTimeout();
    setProcessing(false);
    if (!rawText.trim()) {
      setOcrFailed(true);
      return;
    }
    if (locked.current) return;
    locked.current = true;
    onCapture(mode === 'label' ? { mode: 'label', rawText } : { mode: 'inci', rawText });
  }

  function handleOcrError() {
    clearOcrTimeout();
    engineRef.current?.clearPending();
    setProcessing(false);
    setOcrFailed(true);
  }

  function handleClose() {
    clearOcrTimeout();
    engineRef.current?.clearPending();
    onClose();
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  const permissionDenied = permission !== null && !permission.granted;
  const showFallback = cameraFailed || (permissionDenied && !permission.canAskAgain);

  function renderBody() {
    if (permission === null) {
      return (
        <View style={styles.centerFill}>
          <ActivityIndicator color={palette.white} />
        </View>
      );
    }

    if (showFallback || permissionDenied) {
      return (
        <View style={styles.centerFill}>
          <Feather name="camera-off" size={32} color="rgba(255,255,255,0.6)" />
          <Text style={styles.fallbackText}>Camera unavailable. Use manual entry instead.</Text>
          {permissionDenied && permission.canAskAgain && !cameraFailed ? (
            <Pressable
              style={styles.fallbackBtn}
              onPress={() => void requestPermission()}
              accessibilityRole="button"
            >
              <Text style={styles.fallbackBtnLabel}>Allow Camera Access</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.fallbackBtn}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close and use manual entry"
          >
            <Text style={styles.fallbackBtnLabel}>Use Manual Entry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onMountError={() => setCameraFailed(true)}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={mode === 'barcode' ? handleBarcodeScan : undefined}
        />

        {/* Viewfinder overlay: four L-shaped corner marks, not a full border */}
        <View style={styles.overlay} pointerEvents="none">
          <View style={[styles.viewfinder, mode === 'barcode' && styles.viewfinderBarcode]}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.hint}>{HELPER_COPY[mode]}</Text>
          {processing ? <ReadingIndicator /> : null}
        </View>

        {ocrFailed ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              Could not read the text. Try again, or close and use manual entry.
            </Text>
          </View>
        ) : null}

        {isOcrMode ? (
          <View style={styles.shutterWrap} pointerEvents="box-none">
            <Pressable
              style={({ pressed }) => [styles.shutterBtn, pressed && styles.shutterBtnPressed]}
              onPress={() => void handleShutter()}
              disabled={processing}
              accessibilityRole="button"
              accessibilityLabel="Capture photo"
            >
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        ) : null}
      </>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.fullscreen}>
        {renderBody()}

        {/* Shared OCR engine — kept outside renderBody's error branches so the
            Tesseract worker survives transient error states while visible. */}
        {isOcrMode ? (
          <OcrEngineWebView ref={engineRef} onResult={handleOcrText} onError={handleOcrError} />
        ) : null}

        <SafeAreaView style={styles.closeWrap} pointerEvents="box-none">
          <Pressable
            style={styles.closeBtn}
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
          >
            <Feather name="x" size={20} color={palette.white} />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CORNER_SIZE = 24;
const CORNER_W = 3;

const styles = StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: '#000' },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    paddingHorizontal: space.gutterScreen,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
  },
  viewfinder: {
    width: 280,
    height: 220,
    position: 'relative',
  },
  viewfinderBarcode: {
    width: 260,
    height: 160,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: palette.white,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W },
  hint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingHorizontal: space.gutterScreen,
  },

  readingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.pill,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  readingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.marigold,
  },
  readingLabel: {
    ...typography.bodySmall,
    color: palette.white,
  },

  errorCard: {
    position: 'absolute',
    bottom: 140,
    left: space.gutterScreen,
    right: space.gutterScreen,
    backgroundColor: 'rgba(9,9,11,0.88)',
    borderRadius: radius.xl,
    padding: space[4],
  },
  errorText: {
    ...typography.bodySmall,
    color: palette.white,
    textAlign: 'center',
  },

  shutterWrap: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutterBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtnPressed: { opacity: 0.7 },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.white,
  },

  closeWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
  },
  closeBtn: {
    position: 'absolute',
    top: space[4],
    right: space[4],
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fallbackText: {
    ...typography.body,
    color: palette.white,
    textAlign: 'center',
  },
  fallbackBtn: {
    paddingHorizontal: space[6],
    paddingVertical: space[3],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  fallbackBtnLabel: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.white,
  },
});
