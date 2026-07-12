import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { OcrEngineWebView } from '@/components/camera/OcrEngineWebView';
import type { OcrEngineHandle } from '@/components/camera/OcrEngineWebView';
import { Button } from '@/components/ui/core/Button';
import { Input } from '@/components/ui/forms/Input';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { CaptureMode, CaptureResult } from '@/types';
import { ocrTextCleaner } from '@/utils/ocrTextCleaner';
import {
  manualBarcodeError,
  normalizeManualBarcode,
} from '@/utils/productForm/barcodeValidation';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CameraCaptureModalProps {
  mode: CaptureMode; // 'label' | 'barcode' | 'inci'
  visible: boolean;
  onClose: () => void;
  onCapture: (result: CaptureResult) => void;
}

/**
 * The single reusable capture entry point for the Add Product flow, split
 * by capture mechanism:
 *
 * - `barcode` — live in-app decoder modal (real-time scanning suits a fixed
 *   rectangular frame), plus a manual digit-entry fallback.
 * - `label` / `inci` — the system camera via expo-image-picker with
 *   `allowsEditing`, exactly like the pre-70df13b OcrScannerSheet: the user
 *   crops the shot to the text themselves (packaging text runs vertical,
 *   curved, wrapped — no fixed in-app frame fits it), then the photo goes
 *   to the shared Tesseract engine. Deliberately NO programmatic crop
 *   computation here.
 *
 * Data leaves ONLY through `onCapture` — this component never touches the
 * form reducer.
 */
export function CameraCaptureModal(props: CameraCaptureModalProps) {
  if (props.mode === 'barcode') return <BarcodeCaptureModal {...props} />;
  return <OcrPhotoFlow {...props} />;
}

// ═══ Barcode: live in-app scanner modal ═══════════════════════════════════════

/** How long unsuccessful scanning runs before the "way out" hint appears. */
const TROUBLE_HINT_MS = 9_000;

function BarcodeCaptureModal({ mode, visible, onClose, onCapture }: CameraCaptureModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFailed, setCameraFailed] = useState(false);
  const [showTroubleHint, setShowTroubleHint] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Cooldown so a decode (or manual submit) fires onCapture exactly once per open.
  const locked = useRef(false);

  useEffect(() => {
    if (!visible) return;
    // Fresh state on every open.
    locked.current = false;
    setCameraFailed(false);
    setShowTroubleHint(false);
    setManualText('');
    setManualError(null);
    const hintTimer = setTimeout(() => setShowTroubleHint(true), TROUBLE_HINT_MS);
    return () => clearTimeout(hintTimer);
  }, [visible]);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleBarcodeScan = useCallback(
    ({ data }: { data: string }) => {
      if (locked.current) return;
      locked.current = true;
      onCapture({ mode: 'barcode', code: data });
    },
    [onCapture],
  );

  function handleManualSubmit() {
    const error = manualBarcodeError(manualText);
    if (error) {
      setManualError(error);
      return;
    }
    const code = normalizeManualBarcode(manualText);
    if (code === null || locked.current) return;
    locked.current = true;
    // Same exit as a live decode: the parent section owns the dispatch.
    onCapture({ mode: 'barcode', code });
  }

  const permissionDenied = permission !== null && !permission.granted;
  const showFallback = cameraFailed || permissionDenied;

  function renderFallback() {
    return (
      <View style={styles.centerFill}>
        <Feather name="camera-off" size={32} color="rgba(255,255,255,0.6)" />
        <Text style={styles.fallbackText}>
          Camera unavailable. Enter the barcode below or use manual entry.
        </Text>
        {permissionDenied && permission?.canAskAgain && !cameraFailed ? (
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
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close and use manual entry"
        >
          <Text style={styles.fallbackBtnLabel}>Use Manual Entry</Text>
        </Pressable>
      </View>
    );
  }

  function renderScanner() {
    return (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onMountError={() => setCameraFailed(true)}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={handleBarcodeScan}
        />
        {/* Viewfinder overlay: four L-shaped corner marks, not a full border */}
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.hint}>Point at the barcode on the box</Text>
          {showTroubleHint ? (
            <Text style={styles.troubleHint}>
              Having trouble scanning? Enter the barcode below, or close.
            </Text>
          ) : null}
        </View>
      </>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.fullscreen}>
        {permission === null ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={palette.white} />
          </View>
        ) : showFallback ? (
          renderFallback()
        ) : (
          renderScanner()
        )}

        {/*
          Close control: the button sits in NORMAL flow inside the SafeAreaView.
          The previous absolute-positioned button inside a height-collapsed
          absolute wrapper put the touch target outside its parent's bounds on
          devices with small/zero top insets, so taps were silently dropped —
          the "close button stops working" bug.
        */}
        <SafeAreaView style={styles.closeWrap} pointerEvents="box-none">
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
          >
            <Feather name="x" size={20} color={palette.white} />
          </Pressable>
        </SafeAreaView>

        {/* Manual entry — always available, not only after a failed scan. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.manualWrap}
          pointerEvents="box-none"
        >
          <SafeAreaView pointerEvents="box-none">
            <View style={styles.manualCard}>
              <Text style={styles.manualHint}>Can&apos;t scan? Enter the barcode manually.</Text>
              <Input
                value={manualText}
                onChangeText={(text) => {
                  setManualText(text);
                  if (manualError) setManualError(null);
                }}
                keyboardType="number-pad"
                maxLength={13}
                placeholder="12 or 13 digits"
                error={manualError}
                returnKeyType="done"
                onSubmitEditing={handleManualSubmit}
                accessibilityLabel="Barcode digits"
              />
              <Button variant="primary" size="lg" fullWidth onPress={handleManualSubmit}>
                Use this barcode
              </Button>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ═══ Label / INCI: system camera or gallery photo → shared OCR engine ═════════

const OCR_TIMEOUT_MS = 10_000;
/** High JPEG quality: 0.5 compression on small INCI print measurably hurt Tesseract. */
const PHOTO_QUALITY = 0.85;

const PICKER_TITLE: Record<Exclude<CaptureMode, 'barcode'>, string> = {
  label: 'Scan Front Label',
  inci: 'Scan Ingredient List',
};

function OcrPhotoFlow({ mode, visible, onClose, onCapture }: CameraCaptureModalProps) {
  // Drives the full-screen "Reading…" overlay; set before any OCR work starts.
  const [loading, setLoading] = useState(false);

  // The shared Tesseract engine buffers images until its worker is ready.
  const engineRef = useRef<OcrEngineHandle>(null);
  // Fail-safe: if loading stays true for >10s we auto-reset and surface an error.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearScanTimeout() {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function startScanTimeout() {
    clearScanTimeout();
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setLoading(false);
      engineRef.current?.clearPending();
      Alert.alert('Error', 'Scanner timed out. Please try again.', [
        { text: 'OK', onPress: onClose },
      ]);
    }, OCR_TIMEOUT_MS);
  }

  useEffect(() => {
    if (!visible) {
      clearScanTimeout();
      setLoading(false);
      // The engine's worker readiness survives visibility toggles; only a
      // queued image must be dropped.
      engineRef.current?.clearPending();
      return;
    }
    showPickerAlert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Clear the timeout if the component is unmounted while a scan is in progress.
  useEffect(() => () => clearScanTimeout(), []);

  function showPickerAlert() {
    Alert.alert(PICKER_TITLE[mode === 'barcode' ? 'label' : mode], undefined, [
      { text: 'Take Photo', onPress: () => void handleCamera() },
      { text: 'Choose from Gallery', onPress: () => void handleGallery() },
      { text: 'Cancel', style: 'cancel', onPress: onClose },
    ]);
  }

  async function handleCamera() {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Camera Access Needed',
        'Enable camera access in Settings to take a photo of the packaging.',
        [{ text: 'OK', onPress: onClose }],
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: PHOTO_QUALITY,
      base64: true,
      // The system crop UI is the whole point: the user trims the shot to
      // the text region themselves — no in-code crop-rect math.
      allowsEditing: true,
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
      allowsEditing: true,
    });
    if (result.canceled) {
      onClose();
      return;
    }
    handlePickedImage(result.assets[0]?.base64 ?? null);
  }

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
    setLoading(false);

    if (mode === 'label') {
      // Keep Tesseract's line breaks: the line-assignment chips downstream
      // need them. Per-line cleanup happens in splitLabelLines — the full
      // ocrTextCleaner is INCI-specific (flattens newlines to commas and
      // strips accented brand-name letters).
      if (!rawText.trim()) {
        showOcrError();
        return;
      }
      onCapture({ mode: 'label', rawText });
      return;
    }

    const { cleanedText, hadNonLatin } = ocrTextCleaner(rawText);
    if (!cleanedText.trim()) {
      showOcrError();
      return;
    }
    onCapture({ mode: 'inci', rawText: cleanedText, hadNonLatin });
  }

  function showOcrError() {
    clearScanTimeout();
    setLoading(false);
    engineRef.current?.clearPending();
    Alert.alert('Scan Failed', 'Could not read the text. Try again, or use manual entry.', [
      { text: 'Try Again', onPress: showPickerAlert },
      { text: 'Cancel', style: 'cancel', onPress: onClose },
    ]);
  }

  // The engine WebView is kept mounted for the whole time the flow is open —
  // unmounting destroys the Tesseract worker and forces a fresh CDN download.
  if (!visible) return null;

  return (
    <>
      <OcrEngineWebView ref={engineRef} onResult={handleOcrText} onError={showOcrError} />

      {/* Loading overlay while the system picker hands off to Tesseract. */}
      <Modal visible={loading} transparent statusBarTranslucent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.textPrimary} />
            <Text style={styles.loadingLabel}>Reading text…</Text>
          </View>
        </View>
      </Modal>
    </>
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
    width: 260,
    height: 160,
    position: 'relative',
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
  troubleHint: {
    ...typography.bodySmall,
    color: palette.white,
    textAlign: 'center',
    paddingHorizontal: space.gutterScreen,
  },

  closeWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    alignItems: 'flex-end',
  },
  closeBtn: {
    marginTop: space[4],
    marginRight: space[4],
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  manualWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  manualCard: {
    backgroundColor: colors.bgBase,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space[4],
    gap: space[3],
  },
  manualHint: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },

  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    backgroundColor: colors.bgBase,
    borderRadius: radius.xl,
    paddingHorizontal: space[8],
    paddingVertical: space[6],
    alignItems: 'center',
    gap: space[3],
  },
  loadingLabel: {
    ...typography.body,
    color: colors.textPrimary,
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
