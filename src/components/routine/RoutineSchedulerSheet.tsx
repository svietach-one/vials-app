import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/core/BottomSheet';
import { Button } from '@/components/ui/core/Button';
import { TimeChip } from '@/components/ui/core/TimeChip';
import { WeeklySchedulePicker } from '@/components/routine/WeeklySchedulePicker';
import { colors, radius, space, typography } from '@/constants/tokens';
import { useRoutinesStore } from '@/store/routinesStore';
import { derivePeriodSchedules } from '@/utils/routineLabel';
import type { ProductType } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoutineSchedulerSheetProps {
  visible: boolean;
  productId: string;
  productType: ProductType;
  onClose: () => void;
  title?: string;
  cancelLabel?: string;
  saveLabel?: string;
  onHide?: () => void;
  onRemove?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RoutineSchedulerSheet({
  visible,
  productId,
  productType,
  onClose,
  title,
  cancelLabel = 'Cancel',
  saveLabel = 'Save',
  onHide,
  onRemove,
}: RoutineSchedulerSheetProps) {
  const upsertProductStep = useRoutinesStore((s) => s.upsertProductStep);
  const removeProductStep = useRoutinesStore((s) => s.removeProductStep);

  const [morning, setMorning] = useState(false);
  const [evening, setEvening] = useState(false);
  // Morning and evening are independently schedulable for the same product
  // (a step's scheduledDays lives on RoutineStep, per period) — these must
  // stay two separate values, never one shared array, or Save silently
  // overwrites one period's real schedule with the other's.
  const [morningScheduledDays, setMorningScheduledDays] = useState<number[]>([]);
  const [eveningScheduledDays, setEveningScheduledDays] = useState<number[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Pre-populate from current store state when the sheet opens.
  // Reading store state imperatively avoids re-populating while the sheet
  // is already open if an unrelated store update fires.
  useEffect(() => {
    if (!visible) {
      setValidationError(null);
      return;
    }
    const current = derivePeriodSchedules(
      useRoutinesStore.getState().routines,
      productId,
    );
    setMorning(current.morning.included);
    setEvening(current.evening.included);
    setMorningScheduledDays(current.morning.scheduledDays);
    setEveningScheduledDays(current.evening.scheduledDays);
  }, [visible, productId]);

  function handleSave() {
    if (!morning && !evening) {
      setValidationError('Please select when you will be using this product (Morning, Evening, or Both)');
      return;
    }
    setValidationError(null);

    const { routines } = useRoutinesStore.getState();
    const morningRoutine = routines.find((r) => r.timeOfDay === 'morning');
    const eveningRoutine = routines.find((r) => r.timeOfDay === 'evening');

    if (morningRoutine) {
      if (morning) {
        upsertProductStep(morningRoutine.id, productId, productType, morningScheduledDays);
      } else {
        removeProductStep(morningRoutine.id, productId);
      }
    }

    if (eveningRoutine) {
      if (evening) {
        upsertProductStep(eveningRoutine.id, productId, productType, eveningScheduledDays);
      } else {
        removeProductStep(eveningRoutine.id, productId);
      }
    }

    onClose();
  }

  return (
    <BottomSheet
      title={title ?? 'Add to Routine'}
      visible={visible}
      onClose={onClose}
      dismissOnBackdrop={false}
      contentStyle={styles.sheetContent}
    >
      {/* Section 1: Time of Day */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Time of Day</Text>
        <View style={styles.chipRow}>
          <TimeChip
            icon="sun"
            label="Morning"
            active={morning}
            onPress={() => { setMorning((v) => !v); setValidationError(null); }}
          />
          <TimeChip
            icon="moon"
            label="Evening"
            active={evening}
            onPress={() => { setEvening((v) => !v); setValidationError(null); }}
          />
        </View>
      </View>

      {validationError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{validationError}</Text>
        </View>
      ) : null}

      {/* Section 2: Weekly Planner — one independent picker per active period.
          Each period keeps its own scheduledDays; showing a single shared
          picker here would imply a unified schedule that doesn't exist in
          the data model. */}
      {morning ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Morning days</Text>
          <WeeklySchedulePicker scheduledDays={morningScheduledDays} onUpdate={setMorningScheduledDays} />
        </View>
      ) : null}

      {evening ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Evening days</Text>
          <WeeklySchedulePicker scheduledDays={eveningScheduledDays} onUpdate={setEveningScheduledDays} />
        </View>
      ) : null}

      {/* Section 3: Actions */}
      <View style={styles.actions}>
        <Button variant="secondary" size="lg" onPress={onClose} style={styles.actionBtn}>
          {cancelLabel}
        </Button>
        <Button size="lg" onPress={handleSave} style={styles.actionBtn}>
          {saveLabel}
        </Button>
      </View>

      {/* Destructive actions */}
      {(onHide || onRemove) ? (
        <View style={styles.destructiveActions}>
          {onHide ? (
            <Button variant="ghost" size="sm" onPress={() => { onClose(); onHide(); }}>
              Hide product
            </Button>
          ) : null}
          {onRemove ? (
            <Button variant="destructive" size="sm" onPress={() => { onClose(); onRemove(); }}>
              Remove from routine
            </Button>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: space.gutterScreen,
  },
  section: {
    gap: space[2],
    marginBottom: space[5],
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  errorBanner: {
    backgroundColor: colors.statusErrorTint,
    borderRadius: radius.sm,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderLeftWidth: 3,
    borderLeftColor: colors.statusError,
    marginBottom: space[5],
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.statusError,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: space[3],
    marginTop: space[4],
  },
  actionBtn: {
    flex: 1,
  },
  destructiveActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space[5],
    marginTop: space[4],
    paddingBottom: space[2],
  },
});
