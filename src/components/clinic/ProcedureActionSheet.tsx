import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { Button } from '@/components/ui/core/Button';
import { ListRow } from '@/components/ui/core/ListRow';
import { colors, radius, space } from '@/constants/tokens';
import type { UserProcedureLog } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcedureActionSheetProps {
  /** Passing null hides the sheet. */
  proc: UserProcedureLog | null;
  onDetails: (p: UserProcedureLog) => void;
  onMoveToHistory: (p: UserProcedureLog) => void;
  onDelete: (p: UserProcedureLog) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProcedureActionSheet({
  proc,
  onDetails,
  onMoveToHistory,
  onDelete,
  onClose,
}: ProcedureActionSheetProps) {
  const isArchived = proc?.status === 'archived';

  return (
    <Modal
      visible={proc !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* onStartShouldSetResponder prevents backdrop press when sheet is tapped */}
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />

          {/* Details — edit date / add a note on a dedicated page */}
          <ListRow
            leading={<Icon name="edit-2" size={18} color={colors.textPrimary} />}
            title="Details"
            onPress={() => {
              if (proc) {
                onDetails(proc);
                onClose();
              }
            }}
          />

          {/* Move to history — archive out of the Active tab */}
          {!isArchived ? (
            <ListRow
              leading={<Icon name="archive" size={18} color={colors.textPrimary} />}
              title="Move to history"
              onPress={() => {
                if (proc) {
                  onMoveToHistory(proc);
                  onClose();
                }
              }}
            />
          ) : null}

          {/* Delete */}
          <ListRow
            leading={<Icon name="trash-2" size={18} color={colors.statusError} />}
            title="Delete"
            titleColor={colors.statusError}
            onPress={() => {
              if (proc) {
                onDelete(proc);
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
