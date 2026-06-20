import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '@/components/ui/core/Button';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { searchProducts } from '@/services/openBeautyFacts/search';
import type { OBFProduct } from '@/services/openBeautyFacts/types';
import { AddProductModal } from '@/components/product/AddProductModal';
import type { RoutineTarget } from '@/components/product/AddProductModal';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { generateId } from '@/utils/generateId';
import type { Product, RoutineStep } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<CatalogStackParamList, 'BarcodeScanner'>;

type ScanState = 'scanning' | 'looking_up' | 'found' | 'not_found' | 'error';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BarcodeScannerScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [obfResult, setObfResult] = useState<OBFProduct | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const cooldown = useRef(false);

  const addProduct = useProductsStore((s) => s.addProduct);
  const routines = useRoutinesStore((s) => s.routines);
  const updateRoutine = useRoutinesStore((s) => s.updateRoutine);

  // ── Routine linking (same logic as AddProductHubScreen) ───────────────────

  function addProductToRoutine(product: Product, target: RoutineTarget) {
    if (target === 'none') return;
    function makeStep(): RoutineStep {
      return { id: generateId(), productType: product.productType, productId: product.id, hidden: false, scheduledDays: [] };
    }
    if (target === 'morning' || target === 'both') {
      const r = routines.find((x) => x.timeOfDay === 'morning');
      if (r) updateRoutine(r.id, { steps: [...r.steps, makeStep()] });
    }
    if (target === 'evening' || target === 'both') {
      const r = routines.find((x) => x.timeOfDay === 'evening');
      if (r) updateRoutine(r.id, { steps: [...r.steps, makeStep()] });
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleBarcodeScan({ data }: { data: string }) {
    // Debounce: ignore additional scans while processing
    if (cooldown.current || scanState !== 'scanning') return;
    cooldown.current = true;

    setScanState('looking_up');

    try {
      const { products, failed } = await searchProducts(data);
      if (failed) {
        setScanState('error');
      } else if (products.length > 0) {
        setObfResult(products[0]);
        setScanState('found');
      } else {
        setScanState('not_found');
      }
    } catch {
      setScanState('error');
    }
  }

  function handleSave(product: Product, routineTarget: RoutineTarget) {
    addProduct(product);
    addProductToRoutine(product, routineTarget);
    setModalVisible(false);
    navigation.goBack();
  }

  function resetScanner() {
    setObfResult(null);
    setScanState('scanning');
    // Lift cooldown after a short delay so the camera has time to resume
    setTimeout(() => { cooldown.current = false; }, 500);
  }

  // ── Permission states ─────────────────────────────────────────────────────

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={styles.loader} color={colors.textSecondary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permWrap}>
          <Feather name="camera-off" size={32} color={colors.textTertiary} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permBody}>
            Allow camera access to scan product barcodes and look them up in Open Beauty Facts.
          </Text>
          {permission.canAskAgain ? (
            <Button variant="primary" onPress={requestPermission}>
              Allow Camera Access
            </Button>
          ) : (
            <InlineAlert tone="warning" title="Permission denied">
              Open Settings and grant camera access to Expo Go, then return here.
            </InlineAlert>
          )}
          <Button variant="ghost" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.fullscreen}>
      {/* Camera always rendered in background */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanState === 'scanning' ? handleBarcodeScan : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'] }}
      />

      {/* Dark overlay with viewfinder cutout hint */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.hint}>Align barcode within the frame</Text>
      </View>

      {/* Close button */}
      <SafeAreaView style={styles.closeWrap} pointerEvents="box-none">
        <Pressable
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
        >
          <Feather name="x" size={20} color={palette.white} />
        </Pressable>
      </SafeAreaView>

      {/* Status cards */}
      {scanState === 'looking_up' && (
        <View style={styles.statusCard}>
          <ActivityIndicator color={palette.white} />
          <Text style={styles.statusText}>Looking up product…</Text>
        </View>
      )}

      {scanState === 'found' && obfResult && (
        <View style={styles.resultCard}>
          <View style={styles.resultContent}>
            <Text style={styles.resultName} numberOfLines={2}>{obfResult.name}</Text>
            {obfResult.brand ? (
              <Text style={styles.resultBrand} numberOfLines={1}>{obfResult.brand}</Text>
            ) : null}
          </View>
          <View style={styles.resultActions}>
            <Pressable
              style={styles.addBtn}
              onPress={() => setModalVisible(true)}
              accessibilityRole="button"
            >
              <Feather name="plus" size={16} color={palette.white} />
              <Text style={styles.addBtnLabel}>Add to Catalog</Text>
            </Pressable>
            <Pressable
              style={styles.scanAgainBtn}
              onPress={resetScanner}
              accessibilityRole="button"
            >
              <Text style={styles.scanAgainLabel}>Scan Again</Text>
            </Pressable>
          </View>
        </View>
      )}

      {(scanState === 'not_found' || scanState === 'error') && (
        <View style={styles.resultCard}>
          <Text style={styles.resultName}>
            {scanState === 'error'
              ? 'Lookup unavailable'
              : 'Product not found in database'}
          </Text>
          <Text style={styles.resultBrand}>
            {scanState === 'error'
              ? 'Check your connection and try again.'
              : 'You can still add it manually.'}
          </Text>
          <View style={styles.resultActions}>
            <Pressable
              style={styles.addBtn}
              onPress={() => {
                setObfResult(null);
                setModalVisible(true);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.addBtnLabel}>Add Manually</Text>
            </Pressable>
            <Pressable style={styles.scanAgainBtn} onPress={resetScanner} accessibilityRole="button">
              <Text style={styles.scanAgainLabel}>Scan Again</Text>
            </Pressable>
          </View>
        </View>
      )}

      <AddProductModal
        visible={modalVisible}
        prefillOBFProduct={obfResult}
        onClose={() => {
          setModalVisible(false);
          resetScanner();
        }}
        onSave={handleSave}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CORNER = 24;
const CORNER_W = 3;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  fullscreen: { flex: 1, backgroundColor: '#000' },
  loader: { flex: 1 },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
  },
  viewfinder: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
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
  },

  // Close button
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

  // Status overlay
  statusCard: {
    position: 'absolute',
    bottom: 48,
    left: space.gutterScreen,
    right: space.gutterScreen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: radius.xl,
    padding: space[4],
  },
  statusText: {
    ...typography.body,
    color: palette.white,
  },

  // Result card
  resultCard: {
    position: 'absolute',
    bottom: 48,
    left: space.gutterScreen,
    right: space.gutterScreen,
    backgroundColor: 'rgba(9,9,11,0.88)',
    borderRadius: radius.xl,
    padding: space[5],
    gap: space[4],
  },
  resultContent: { gap: 4 },
  resultName: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: palette.white,
  },
  resultBrand: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.6)',
  },
  resultActions: {
    flexDirection: 'row',
    gap: space[2],
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingVertical: space[3],
    borderRadius: radius.md,
    backgroundColor: palette.white,
  },
  addBtnLabel: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.black,
  },
  scanAgainBtn: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanAgainLabel: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: 'rgba(255,255,255,0.8)',
  },

  // Permission screen
  permWrap: {
    flex: 1,
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[12],
    alignItems: 'center',
    gap: space[4],
  },
  permTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  permBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
