import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { CameraCaptureModal } from '@/components/camera/CameraCaptureModal';
import { Button } from '@/components/ui/core/Button';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { useSettingsStore } from '@/store/settingsStore';
import type { AddProductDraft } from '@/types';
import type { FormAction } from '@/utils/productForm/formReducer';

import { ScanTile } from './ScanTile';

export interface BarcodeSectionProps {
  draft: AddProductDraft;
  dispatch: (action: FormAction) => void;
}

/** How long the inline "contribution saved" confirmation shows before auto-collapsing. */
const CONFIRMATION_MS = 1200;

/** Section 2 — optional barcode scan framed as a community contribution. */
export function BarcodeSection({ draft, dispatch }: BarcodeSectionProps) {
  const [cameraVisible, setCameraVisible] = useState(false);
  const [justScanned, setJustScanned] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contributionCount = useSettingsStore((s) => s.communityContributionCount);
  const incrementCommunityContribution = useSettingsStore(
    (s) => s.incrementCommunityContribution,
  );

  useEffect(() => () => {
    if (collapseTimer.current !== null) clearTimeout(collapseTimer.current);
  }, []);

  function handleCapture(code: string) {
    setCameraVisible(false);
    dispatch({ type: 'SET_BARCODE', value: code });
    incrementCommunityContribution();
    setJustScanned(true);
    collapseTimer.current = setTimeout(() => {
      // Section 2 is expanded at this point, so toggling section 3 both
      // collapses this section and opens the next one.
      dispatch({ type: 'TOGGLE_SECTION', section: 3 });
    }, CONFIRMATION_MS);
  }

  const showConfirmation = draft.barcode !== null && justScanned;

  return (
    <View style={styles.wrap}>
      <Text style={styles.framing}>
        Help the community find this product — scanning the barcode lets other users add it in
        one tap.
      </Text>

      {contributionCount > 0 ? (
        <Text style={styles.counter}>
          You&apos;ve helped verify {contributionCount}{' '}
          {contributionCount === 1 ? 'product' : 'products'}
        </Text>
      ) : null}

      {showConfirmation ? (
        <View style={styles.confirmation}>
          <Feather name="check-circle" size={18} color={palette.bottleGreen} />
          <View style={styles.confirmationText}>
            <Text style={styles.confirmationCode}>{draft.barcode}</Text>
            <Text style={styles.confirmationLabel}>Community contribution saved</Text>
          </View>
        </View>
      ) : (
        <>
          {draft.barcode !== null ? (
            <View style={styles.savedRow}>
              <Feather name="check" size={16} color={colors.textSecondary} />
              <Text style={styles.savedCode}>{draft.barcode}</Text>
            </View>
          ) : null}

          <ScanTile
            icon="maximize"
            label={draft.barcode !== null ? 'Scan again' : 'Scan barcode'}
            onPress={() => setCameraVisible(true)}
            compact
          />

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => dispatch({ type: 'SKIP_BARCODE' })}
          >
            Skip — no barcode available
          </Button>
        </>
      )}

      <CameraCaptureModal
        mode="barcode"
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onCapture={(result) => {
          if (result.mode === 'barcode') handleCapture(result.code);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space[3],
  },
  framing: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  counter: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'DMSans-Medium',
  },
  confirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: palette.bottleGreenTint,
    borderWidth: 1,
    borderColor: palette.bottleGreenLine,
    borderRadius: radius.lg,
    padding: space[4],
  },
  confirmationText: {
    gap: 2,
  },
  confirmationCode: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  confirmationLabel: {
    ...typography.caption,
    color: palette.bottleGreen,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  savedCode: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
