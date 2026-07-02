import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { colors, radius, shadow, space, typography } from '@/constants/tokens';

// ─── Day names ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RemoveStepModalProps {
  visible: boolean;
  productName: string;
  /** 0 = Sunday … 6 = Saturday — the day currently shown in the planner. */
  dow: number;
  onRemoveDay: () => void;
  onRemoveAll: () => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RemoveStepModal({
  visible,
  productName,
  dow,
  onRemoveDay,
  onRemoveAll,
  onCancel,
}: RemoveStepModalProps) {
  const dayPlural = `${DAY_NAMES[dow]}s`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        {/* Stop propagation so tapping the sheet doesn't close the modal */}
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Remove {productName}?</Text>
          <Text style={styles.body}>
            Remove it just from {dayPlural}, or from every day it's scheduled in this routine.
          </Text>

          <View style={styles.actions}>
            <Button variant="secondary" size="lg" onPress={onRemoveDay} fullWidth>
              Remove from {dayPlural}
            </Button>
            <Button variant="destructive" size="lg" onPress={onRemoveAll} fullWidth>
              Remove from all days
            </Button>
            <Button variant="ghost" size="lg" onPress={onCancel} fullWidth>
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
    gap: space[4],
    ...shadow.lg,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    gap: space[3],
    marginTop: space[1],
  },
});
