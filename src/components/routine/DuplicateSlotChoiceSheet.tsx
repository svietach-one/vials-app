import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { RadioConfirmModal } from '@/components/ui/core/RadioConfirmModal';
import type { RadioOption } from '@/components/ui/forms/RadioOptionGroup';
import { colors, typography } from '@/constants/tokens';
import type { Product } from '@/types';

/**
 * Story 1 (routine-similar-product-priority): manual-add duplicate-slot
 * choice sheet. multi-action-radio-picker (FE-3) converts the old
 * three-stacked-Button layout (one tap = select-and-commit) to a
 * `RadioConfirmModal`: a Replace/Keep both radio pair, pre-selected on
 * "Replace" (the previous primary action), then a Confirm/Cancel footer.
 * Fires before any store write — zero silent data loss (spec §9 success
 * metric). External prop contract unchanged (tech design §1).
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

type DuplicateSlotScope = 'replace' | 'keep_both';

const OPTIONS: RadioOption<DuplicateSlotScope>[] = [
  { value: 'replace', label: 'Replace' },
  { value: 'keep_both', label: 'Keep both' },
];

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
  const handleConfirm = (scope: DuplicateSlotScope) => {
    if (scope === 'replace') {
      onReplace();
    } else {
      onKeepBoth();
    }
  };

  return (
    <RadioConfirmModal
      visible={visible}
      title={`You already have a ${slotLabel} in this routine`}
      body={
        <>
          <Text style={styles.fieldLabel}>Currently in your routine</Text>
          <Text style={styles.body}>{existingProduct.name}</Text>
          <Text style={styles.fieldLabel}>Replacing with</Text>
          <Text style={styles.body}>{incomingProduct.name}</Text>
        </>
      }
      options={OPTIONS}
      defaultValue="replace"
      onConfirm={handleConfirm}
      onCancel={onCancel}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.textPrimary,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textPrimary,
  },
});
