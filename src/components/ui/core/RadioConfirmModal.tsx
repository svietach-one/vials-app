import React, { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { RadioOptionGroup, type RadioOption } from '@/components/ui/forms/RadioOptionGroup';
import { colors, radius, shadow, space, typography } from '@/constants/tokens';

/**
 * Shared "pick one of N, then commit" dialog: plain RN `Modal` (transparent,
 * fade) + backdrop + centered sheet, chrome byte-identical to the pre-
 * existing `DuplicateSlotChoiceSheet`/`RemoveStepModal` `styles.backdrop`/
 * `styles.sheet`. Replaces each site's own stacked-Button cluster with a
 * `RadioOptionGroup` + a fixed Cancel/Confirm footer (multi-action-radio-
 * picker tech design §1, §3 FE-2).
 *
 * Owns the selected-value state: seeded from `defaultValue`, reset whenever
 * `visible` transitions false -> true, so a stale in-progress pick never
 * survives a close/reopen cycle.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadioConfirmModalProps<T extends string> {
  visible: boolean;
  title: string;
  body?: ReactNode;
  options: RadioOption<T>[];
  defaultValue: T;
  onConfirm: (value: T) => void;
  onCancel: () => void;
  testID?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RadioConfirmModal<T extends string>({
  visible,
  title,
  body,
  options,
  defaultValue,
  onConfirm,
  onCancel,
  testID,
}: RadioConfirmModalProps<T>) {
  const [selected, setSelected] = useState<T>(defaultValue);

  // Reset to defaultValue every time the modal (re)opens — an in-progress
  // pick from a previous visit must not survive a close/reopen round trip.
  useEffect(() => {
    if (visible) {
      setSelected(defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      testID={testID}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Stop propagation so tapping the sheet doesn't close the modal */}
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}

          <RadioOptionGroup options={options} value={selected} onChange={setSelected} />

          <View style={styles.actions}>
            <Button variant="secondary" size="lg" onPress={onCancel} style={styles.btn}>
              Cancel
            </Button>
            <Button variant="primary" size="lg" onPress={() => onConfirm(selected)} style={styles.btn}>
              Confirm
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
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: space[3],
    marginTop: space[2],
  },
  btn: {
    flex: 1,
  },
});
