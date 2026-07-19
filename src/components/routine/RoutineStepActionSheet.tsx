import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, space, typography } from '@/constants/tokens';
import type { Product } from '@/types';

/**
 * Overflow actions for one routine step (img-03). Mirrors the shelf's
 * ProductActionSheet pattern (modal + backdrop + icon rows, tokens only) so
 * both surfaces feel identical. Exactly four actions — note that "Remove from
 * routine" only drops the step; the product stays on the shelf.
 */

export interface RoutineStepActionSheetProps {
  /** Passing null hides the sheet. */
  product: Product | null;
  onViewDetails: (p: Product) => void;
  onEdit: (p: Product) => void;
  onRemoveFromRoutine: (p: Product) => void;
  onHide: (p: Product) => void;
  onClose: () => void;
}

interface RowProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  divider?: boolean;
}

function SheetRow({ icon, label, accessibilityLabel, onPress, divider = true }: RowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, divider && styles.rowDivider, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Feather name={icon} size={18} color={colors.textPrimary} />
      <Text style={styles.rowLabel}>{label}</Text>
    </Pressable>
  );
}

export function RoutineStepActionSheet({
  product,
  onViewDetails,
  onEdit,
  onRemoveFromRoutine,
  onHide,
  onClose,
}: RoutineStepActionSheetProps) {
  function run(action: (p: Product) => void) {
    return () => {
      if (product) {
        action(product);
        onClose();
      }
    };
  }

  return (
    <Modal
      visible={product !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />

          <SheetRow
            icon="info"
            label="View product details"
            accessibilityLabel="View product details"
            onPress={run(onViewDetails)}
          />
          <SheetRow
            icon="edit-2"
            label="Edit product"
            accessibilityLabel="Edit product"
            onPress={run(onEdit)}
          />
          <SheetRow
            icon="minus-circle"
            label="Remove from routine"
            accessibilityLabel="Remove from routine"
            onPress={run(onRemoveFromRoutine)}
          />
          <SheetRow
            icon="eye-off"
            label="Hide from routine"
            accessibilityLabel="Hide from routine"
            onPress={run(onHide)}
            divider={false}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgBase,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: space[8],
    paddingTop: space[3],
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[5],
    paddingVertical: space[4],
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
  },
  rowPressed: {
    backgroundColor: colors.bgSubtle,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
