import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { colors, radius, shadow, space, typography } from '@/constants/tokens';
import type { Product } from '@/types';

/**
 * Story 1 (routine-similar-product-priority): manual-add duplicate-slot
 * choice sheet. Modeled on RemoveStepModal's plain-Modal + backdrop Pressable
 * pattern (a 3-button confirm doesn't need @gorhom/bottom-sheet). Fires
 * before any store write — zero silent data loss (spec §9 success metric).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DuplicateSlotChoiceSheetProps {
  visible: boolean;
  /** Human-friendly category label, e.g. "moisturizer", "SPF". */
  slotLabel: string;
  existingProduct: Product;
  incomingProduct: Product;
  onReplace: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DuplicateSlotChoiceSheet({
  visible,
  slotLabel,
  existingProduct,
  incomingProduct,
  onReplace,
  onKeepBoth,
  onCancel,
}: DuplicateSlotChoiceSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Stop propagation so tapping the sheet doesn't close the modal */}
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{`You already have a ${slotLabel} in this routine`}</Text>
          <Text style={styles.body}>{existingProduct.name}</Text>
          <Text style={styles.body}>{incomingProduct.name}</Text>

          <View style={styles.actions}>
            <Button
              variant="primary"
              size="lg"
              onPress={onReplace}
              fullWidth
              accessibilityLabel={`Replace ${existingProduct.name}`}
            >
              {`Replace ${existingProduct.name}`}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onPress={onKeepBoth}
              fullWidth
              accessibilityLabel="Keep both"
            >
              Keep both
            </Button>
            <Button variant="ghost" size="lg" onPress={onCancel} fullWidth accessibilityLabel="Cancel">
              Cancel
            </Button>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,9,11,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[5],
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.bgBase,
    borderRadius: radius.xl,
    padding: space[6],
    gap: space[3],
    ...shadow.lg,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    gap: space[3],
    marginTop: space[2],
  },
});
