import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';

import { ListRow } from '@/components/ui/core/ListRow';
import { colors, radius, space } from '@/constants/tokens';
import type { Product } from '@/types';

/**
 * Overflow actions for one routine step (img-03). Mirrors the shelf's
 * ProductActionSheet pattern (modal + backdrop + icon rows, tokens only) so
 * both surfaces feel identical. Four actions — note that "Remove from
 * routine" only drops the step; the product stays on the shelf. Remove and Hide
 * exist only when `allowRemoval` is true (Routines edit mode): trimming is
 * deliberate, so outside edit mode the sheet offers the two product-only rows.
 */

export interface RoutineStepActionSheetProps {
  /** Passing null hides the sheet. */
  product: Product | null;
  onViewDetails: (p: Product) => void;
  onEdit: (p: Product) => void;
  onRemoveFromRoutine: (p: Product) => void;
  onHide: (p: Product) => void;
  onClose: () => void;
  /** Show "Remove from routine" and "Hide from routine". Defaults to true. */
  allowRemoval?: boolean;
}

interface RowProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  divider?: boolean;
}

function SheetRow({ icon, label, onPress, divider = true }: RowProps) {
  return (
    <ListRow
      leading={<Icon name={icon} size={18} color={colors.textPrimary} />}
      title={label}
      onPress={onPress}
      divider={divider}
    />
  );
}

export function RoutineStepActionSheet({
  product,
  onViewDetails,
  onEdit,
  onRemoveFromRoutine,
  onHide,
  onClose,
  allowRemoval = true,
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
            onPress={run(onViewDetails)}
          />
          <SheetRow
            icon="edit-2"
            label="Edit product"
            onPress={run(onEdit)}
            divider={allowRemoval}
          />
          {allowRemoval ? (
            <>
              <SheetRow
                icon="minus-circle"
                label="Remove from routine"
                onPress={run(onRemoveFromRoutine)}
              />
              <SheetRow
                icon="eye-off"
                label="Hide from routine"
                onPress={run(onHide)}
                divider={false}
              />
            </>
          ) : null}
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
    paddingHorizontal: space[4],
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
});
