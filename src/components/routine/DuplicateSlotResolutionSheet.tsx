import React from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Button } from '@/components/ui/core/Button';
import { colors, radius, shadow, space, typography } from '@/constants/tokens';
import { useRoutinesStore } from '@/store/routinesStore';
import type { Product } from '@/types';

/**
 * Story 3 (routine-similar-product-priority): resolution sheet opened by
 * tapping DuplicateSlotWarningInline's banner. `rankedProducts` arrives
 * pre-ranked (best/recommended first, from duplicateSlot.ts's rankSlotGroup)
 * — this component never re-sorts. Removal reuses the existing
 * `removeProductStep` store method (tech design Assumption 4 — no new
 * swap-in capability here, that's Story 2's Draft Preview flow) behind a
 * native confirmation, mirroring RemoveRoutineActionSheet's Alert pattern.
 * "Keep all" always dismisses without removing anything — never blocking.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DuplicateSlotResolutionSheetProps {
  visible: boolean;
  onClose: () => void;
  routineId: string;
  /** Human-friendly category label, e.g. "moisturizer", "SPF". */
  slotLabel: string;
  /** Pre-ranked, best/recommended first. */
  rankedProducts: Product[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DuplicateSlotResolutionSheet({
  visible,
  onClose,
  routineId,
  slotLabel,
  rankedProducts,
}: DuplicateSlotResolutionSheetProps) {
  function handleRemove(product: Product) {
    Alert.alert(
      `Remove ${product.name}?`,
      `Remove ${product.name} from this routine? This won't delete it from your shelf.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => useRoutinesStore.getState().removeProductStep(routineId, product.id),
        },
      ],
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{`Similar ${slotLabel}s in this routine`}</Text>
          <Text style={styles.body}>
            These products share a step — keep the ones you want, or remove the rest.
          </Text>

          <View style={styles.list}>
            {rankedProducts.map((product, index) => (
              <View key={product.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  {index === 0 ? (
                    <Text style={styles.recommendedTag}>Recommended</Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => handleRemove(product)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${product.name}`}
                  style={styles.removeBtn}
                >
                  <Feather name="trash-2" size={16} color={colors.statusError} />
                </Pressable>
              </View>
            ))}
          </View>

          <Button variant="ghost" size="lg" onPress={onClose} fullWidth accessibilityLabel="Keep all">
            Keep all
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
  },
  list: {
    gap: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
  },
  rowText: {
    flex: 1,
    gap: space[1],
  },
  productName: {
    ...typography.body,
    color: colors.textPrimary,
  },
  recommendedTag: {
    ...typography.caption,
    color: colors.statusSafe,
    fontFamily: 'DMSans-Medium',
  },
  removeBtn: {
    padding: space[1],
  },
});
