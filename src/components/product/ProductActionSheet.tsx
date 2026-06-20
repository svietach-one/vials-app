import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, space, typography } from '@/constants/tokens';
import type { Product } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductActionSheetProps {
  /** Passing null hides the sheet. */
  product: Product | null;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductActionSheet({
  product,
  onEdit,
  onDelete,
  onClose,
}: ProductActionSheetProps) {
  return (
    <Modal
      visible={product !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* onStartShouldSetResponder prevents backdrop press when sheet is tapped */}
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />

          {/* Edit */}
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowDivider, pressed && styles.rowPressed]}
            onPress={() => {
              if (product) {
                onEdit(product);
                onClose();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit product"
          >
            <Feather name="edit-2" size={18} color={colors.textPrimary} />
            <Text style={styles.rowLabel}>Edit Product</Text>
          </Pressable>

          {/* Delete */}
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowDivider, pressed && styles.rowPressed]}
            onPress={() => {
              if (product) {
                onDelete(product);
                onClose();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Delete product"
          >
            <Feather name="trash-2" size={18} color={colors.statusSOS} />
            <Text style={[styles.rowLabel, styles.rowLabelDestructive]}>Delete Product</Text>
          </Pressable>

          {/* Cancel */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[styles.rowLabel, styles.cancelLabel]}>Cancel</Text>
          </Pressable>
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
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgBase,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[8],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: space[2],
    paddingHorizontal: space[1],
    gap: space[3],
    borderRadius: radius.sm,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
    borderRadius: 0,
  },
  rowPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  rowLabel: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  rowLabelDestructive: {
    color: colors.statusSOS,
  },
  cancelLabel: {
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
});
