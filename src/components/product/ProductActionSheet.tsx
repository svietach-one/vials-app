import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Button } from '@/components/ui/core/Button';
import { ListRow } from '@/components/ui/core/ListRow';
import { colors, radius, space } from '@/constants/tokens';
import type { Product } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductActionSheetProps {
  /** Passing null hides the sheet. */
  product: Product | null;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onToggleHidden: (p: Product) => void;
  onClose: () => void;
  onAddToRoutine?: (p: Product) => void;
  onRemoveFromRoutine?: (p: Product) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductActionSheet({
  product,
  onEdit,
  onDelete,
  onToggleHidden,
  onClose,
  onAddToRoutine,
  onRemoveFromRoutine,
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
          <ListRow
            leading={<Feather name="edit-2" size={18} color={colors.textPrimary} />}
            title="Edit Product"
            onPress={() => {
              if (product) {
                onEdit(product);
                onClose();
              }
            }}
          />

          {/* Add/Remove from routine */}
          {onAddToRoutine ? (
            <ListRow
              leading={<Feather name="plus-circle" size={18} color={colors.textPrimary} />}
              title="Add to routine"
              onPress={() => {
                if (product) {
                  onAddToRoutine(product);
                  onClose();
                }
              }}
            />
          ) : onRemoveFromRoutine ? (
            <ListRow
              leading={<Feather name="minus-circle" size={18} color={colors.textPrimary} />}
              title="Remove from routine"
              onPress={() => {
                if (product) {
                  onRemoveFromRoutine(product);
                  onClose();
                }
              }}
            />
          ) : null}

          {/* Hide/Show — independent of the routine row above */}
          <ListRow
            leading={
              <Feather
                name={product?.isHidden ? 'eye' : 'eye-off'}
                size={18}
                color={colors.textPrimary}
              />
            }
            title={product?.isHidden ? 'Show Product' : 'Hide Product'}
            onPress={() => {
              if (product) {
                onToggleHidden(product);
                onClose();
              }
            }}
          />

          {/* Delete */}
          <ListRow
            leading={<Feather name="trash-2" size={18} color={colors.statusError} />}
            title="Delete Product"
            titleColor={colors.statusError}
            onPress={() => {
              if (product) {
                onDelete(product);
                onClose();
              }
            }}
          />

          {/* Cancel */}
          <Button variant="ghost" size="lg" fullWidth onPress={onClose} style={styles.cancelBtn}>
            Cancel
          </Button>
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
  cancelBtn: {
    marginTop: space[2],
  },
});
