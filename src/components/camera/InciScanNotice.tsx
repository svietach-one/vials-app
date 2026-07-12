import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Button } from '@/components/ui/core/Button';
import { colors, radius, space, typography } from '@/constants/tokens';

export interface InciScanNoticeProps {
  visible: boolean;
  /** "Got it, scan now" — dismiss the notice, then open the INCI camera. */
  onScan: () => void;
  /** "Use manual checklist instead" — dismiss entirely; the camera never opens. */
  onUseChecklist: () => void;
}

/**
 * Mandatory pre-scan language notice, shown EVERY time "Scan INCI list" is
 * tapped — before CameraCaptureModal mode="inci" is ever mounted. The
 * client-side matcher only recognizes Latin INCI names, so scanning a
 * translated distributor sticker yields zero matches with no visible error;
 * this notice is the fix for that silent failure mode.
 *
 * Deliberately has NO "don't show again" toggle or persisted dismissal flag
 * (per docs/specs/add-product-flow/05-inci-notice.md) — do not add one.
 */
export function InciScanNotice({ visible, onScan, onUseChecklist }: InciScanNoticeProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Hardware back = the safe path: no camera, back to the checklist.
      onRequestClose={onUseChecklist}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Feather name="globe" size={22} color={colors.textPrimary} />
          </View>

          <Text style={styles.heading}>Scan the original ingredients list</Text>

          <Text style={styles.body}>
            Please scan the original INCI ingredients list in Latin characters (English/Latin
            names only). Do not scan localized translations or distributor stickers.
          </Text>

          <Text style={styles.supporting}>
            This keeps ingredient matching accurate. If your product only has a translated
            label, use the manual checklist instead.
          </Text>

          <View style={styles.actions}>
            <Button variant="primary" size="lg" fullWidth onPress={onScan}>
              Got it, scan now
            </Button>
            <Button variant="ghost" size="lg" fullWidth onPress={onUseChecklist}>
              Use manual checklist instead
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.gutterScreen,
  },
  card: {
    width: '100%',
    backgroundColor: colors.bgBase,
    borderRadius: radius.xl,
    padding: space[6],
    gap: space[3],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[1],
  },
  heading: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  body: {
    ...typography.body,
    color: colors.textPrimary,
  },
  supporting: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    marginTop: space[3],
    gap: space[2],
  },
});
