import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { IconButton } from '@/components/ui/core/IconButton';
import { colors, radius, space, typography } from '@/constants/tokens';

export interface InfoTooltipProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
}

/**
 * Generic static-content tooltip — slide-up card + header + close
 * `IconButton`, visual shell reused from
 * `src/components/routine/AttributionTooltip.tsx`, dropping its per-match
 * (`matches`/`getAliasMicroCopy`) logic for a single static `title`/`body`
 * pair. Introduced by `explore-actives-order-info` FE-1; lives in
 * `src/components/ui/` since it carries no domain-specific data (tech design
 * §4 assumptions). Rendered via RN's `Modal` (this app's established
 * overlay primitive — see `Select.tsx`/`RemoveStepModal.tsx`/etc.) rather
 * than an in-place absolutely-positioned `View`, so it renders above
 * everything regardless of where `DetectedActivesCard` sits inside a
 * scrollable list — a local sibling `View` would only cover that card's own
 * bounds, not the full screen. No backdrop dimming — tapping outside the
 * card still closes it via an invisible full-screen `Pressable`.
 */
export function InfoTooltip({ visible, onClose, title, body }: InfoTooltipProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="info-tooltip"
    >
      <View style={styles.root}>
        <Pressable testID="info-tooltip-backdrop" style={styles.backdrop} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.header} testID="info-tooltip-header">
              {title}
            </Text>
            <IconButton
              testID="info-tooltip-close"
              icon={<Icon name="x" size={18} color={colors.textSecondary} />}
              label="Close"
              variant="ghost"
              size="sm"
              onPress={onClose}
            />
          </View>

          <Text style={styles.copy}>{body}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: colors.bgBase,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space[5],
    paddingTop: space[5],
    paddingBottom: space[8],
    gap: space[3],
    maxHeight: '70%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
  },
  header: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  copy: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    lineHeight: 20,
  },
});
