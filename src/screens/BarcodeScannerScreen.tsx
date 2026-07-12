import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { lookupByBarcode } from '@/services/openBeautyFacts/search';
import type { OBFProduct } from '@/services/openBeautyFacts/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<CatalogStackParamList, 'BarcodeScanner'>;

type ScanState = 'scanning' | 'looking_up' | 'found' | 'not_found' | 'error';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CameraPermissionScreenProps {
  permission: { canAskAgain: boolean };
  onRequest: () => void;
  onBack: () => void;
}
function CameraPermissionScreen({ permission, onRequest, onBack }: CameraPermissionScreenProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.permWrap}>
        <Feather name="camera-off" size={32} color={colors.textTertiary} />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          Allow camera access to scan product barcodes and look them up in Open Beauty Facts.
        </Text>
        {permission.canAskAgain ? (
          <Button variant="primary" size="lg" onPress={onRequest}>Allow Camera Access</Button>
        ) : (
          <InlineAlert tone="warning" title="Permission denied">
            Open Settings and grant camera access to Expo Go, then return here.
          </InlineAlert>
        )}
        <Button variant="ghost" size="lg" onPress={onBack}>Go Back</Button>
      </View>
    </SafeAreaView>
  );
}

interface ScanResultCardProps {
  scanState: ScanState;
  obfResult: OBFProduct | null;
  onAdd: () => void;
  onAddManually: () => void;
  onScanAgain: () => void;
}
function ScanResultCard({ scanState, obfResult, onAdd, onAddManually, onScanAgain }: ScanResultCardProps) {
  if (scanState === 'looking_up') {
    return (
      <View style={styles.statusCard}>
        <ActivityIndicator color={palette.white} />
        <Text style={styles.statusText}>Looking up product…</Text>
      </View>
    );
  }
  if (scanState === 'found' && obfResult) {
    return (
      <View style={styles.resultCard}>
        <View style={styles.resultContent}>
          <Text style={styles.resultName} numberOfLines={2}>{obfResult.name}</Text>
          {obfResult.brand ? (
            <Text style={styles.resultBrand} numberOfLines={1}>{obfResult.brand}</Text>
          ) : null}
        </View>
        <View style={styles.resultActions}>
          <Pressable style={styles.addBtn} onPress={onAdd} accessibilityRole="button">
            <Feather name="plus" size={16} color={palette.black} />
            <Text style={styles.addBtnLabel}>Add to Catalog</Text>
          </Pressable>
          <Pressable style={styles.scanAgainBtn} onPress={onScanAgain} accessibilityRole="button">
            <Text style={styles.scanAgainLabel}>Scan Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  if (scanState === 'not_found' || scanState === 'error') {
    return (
      <View style={styles.resultCard}>
        <Text style={styles.resultName}>
          {scanState === 'error' ? 'Lookup unavailable' : 'Product not found in database'}
        </Text>
        <Text style={styles.resultBrand}>
          {scanState === 'error' ? 'Check your connection and try again.' : 'You can still add it manually.'}
        </Text>
        <View style={styles.resultActions}>
          <Pressable style={styles.addBtn} onPress={onAddManually} accessibilityRole="button">
            <Text style={styles.addBtnLabel}>Add Manually</Text>
          </Pressable>
          <Pressable style={styles.scanAgainBtn} onPress={onScanAgain} accessibilityRole="button">
            <Text style={styles.scanAgainLabel}>Scan Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  return null;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BarcodeScannerScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [obfResult, setObfResult] = useState<OBFProduct | null>(null);

  // Cooldown prevents duplicate scans from firing while a lookup is in flight
  const locked = useRef(false);

  // Clear lock when the screen unmounts so it's clean if the user comes back
  useEffect(() => () => { locked.current = false; }, []);

  // ── Barcode handler ───────────────────────────────────────────────────────
  // Always kept as a stable function — never set onBarcodeScanned to undefined.
  // The lock prevents duplicate processing while a lookup is in flight.

  const handleBarcodeScan = useCallback(async ({ data }: { data: string }) => {
    if (locked.current) return;
    locked.current = true;
    setScanState('looking_up');

    const { products, failed } = await lookupByBarcode(data);

    if (failed) {
      setScanState('error');
    } else if (products.length > 0) {
      setObfResult(products[0]);
      setScanState('found');
    } else {
      setScanState('not_found');
    }
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function resetScanner() {
    setObfResult(null);
    setScanState('scanning');
    setTimeout(() => { locked.current = false; }, 300);
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
      <CameraPermissionScreen
        permission={permission}
        onRequest={requestPermission}
        onBack={() => navigation.goBack()}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.fullscreen}>
      {/*
        CameraView is always rendered with barcodeScannerSettings and onBarcodeScanned
        bound. Passing undefined to onBarcodeScanned disables scanning in some SDK
        versions — instead we gate inside handleBarcodeScan via the locked ref.
      */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'],
        }}
        onBarcodeScanned={handleBarcodeScan}
      />

      {/* Viewfinder overlay */}
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

      <ScanResultCard
        scanState={scanState}
        obfResult={obfResult}
        onAdd={() => {
          if (obfResult) {
            navigation.navigate('ManualProductForm', { prefillOBFProduct: obfResult });
          }
        }}
        onAddManually={() => {
          setObfResult(null);
          navigation.navigate('AddProduct');
        }}
        onScanAgain={resetScanner}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CORNER_SIZE = 24;
const CORNER_W = 3;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  fullscreen: { flex: 1, backgroundColor: '#000' },
  loader: { flex: 1 },

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
