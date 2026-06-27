import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
import type { Product } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeleteProductModalProps {
  product: Product | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DeleteProductModal({ product, onConfirm, onCancel }: DeleteProductModalProps) {
  return (
    <Modal
      visible={product !== null}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Stop propagation so tapping the sheet doesn't close the modal */}
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Remove product?</Text>
          <Text style={styles.body}>
            <Text style={styles.productName}>{product?.name}</Text>
            {' will be removed from your catalog. Any routine steps linked to it will become empty slots.'}
          </Text>

          <View style={styles.row}>
            <Button
              variant="secondary"
              size="lg"
              onPress={onCancel}
              style={styles.btn}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="lg"
              onPress={onConfirm}
              style={styles.btn}
            >
              Remove
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
  productName: {
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: space[3],
    marginTop: space[1],
  },
  btn: {
    flex: 1,
  },
});
