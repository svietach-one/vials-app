import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { BottomSheet } from '@/components/ui/core/BottomSheet';
import { Button } from '@/components/ui/core/Button';
import { WeeklySchedulePicker } from '@/components/routine/WeeklySchedulePicker';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { useRoutinesStore } from '@/store/routinesStore';
import { deriveProductSchedule } from '@/utils/routineLabel';
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
  const [scheduledDays, setScheduledDays] = useState<number[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Pre-populate from current store state when the sheet opens.
  // Reading store state imperatively avoids re-populating while the sheet
  // is already open if an unrelated store update fires.
  useEffect(() => {
    if (!visible) {
      setValidationError(null);
      return;
    }
    const current = deriveProductSchedule(
      useRoutinesStore.getState().routines,
      productId,
    );
    setMorning(current.morning);
    setEvening(current.evening);
    setScheduledDays(current.scheduledDays);
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
        upsertProductStep(morningRoutine.id, productId, productType, scheduledDays);
      } else {
        removeProductStep(morningRoutine.id, productId);
      }
    }

    if (eveningRoutine) {
      if (evening) {
        upsertProductStep(eveningRoutine.id, productId, productType, scheduledDays);
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
        <Text style={styles.sectionLabel}>TIME OF DAY</Text>
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

      {/* Section 2: Weekly Planner */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>WEEKLY PLANNER</Text>
        <WeeklySchedulePicker scheduledDays={scheduledDays} onUpdate={setScheduledDays} />
      </View>

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
            <Pressable
              onPress={() => { onClose(); onHide(); }}
              style={styles.destructiveLink}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.destructiveLinkText}>Hide product</Text>
            </Pressable>
          ) : null}
          {onRemove ? (
            <Pressable
              onPress={() => { onClose(); onRemove(); }}
              style={styles.destructiveLink}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={[styles.destructiveLinkText, styles.destructiveLinkTextDanger]}>
                Remove from routine
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

// ─── Time chip ────────────────────────────────────────────────────────────────

function TimeChip({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.timeChip, active && styles.timeChipActive]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
    >
      <Feather
        name={icon}
        size={15}
        color={active ? palette.white : colors.textSecondary}
        style={styles.timeChipIcon}
      />
      <Text style={[styles.timeChipLabel, active && styles.timeChipLabelActive]}>
        {label}
      </Text>
    </Pressable>
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
  timeChip: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  timeChipIcon: {},
  timeChipActive: {
    backgroundColor: palette.black,
    borderColor: palette.black,
  },
  timeChipLabel: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
  timeChipLabelActive: {
    color: palette.white,
  },
  errorBanner: {
    backgroundColor: colors.statusSOSTint,
    borderRadius: radius.sm,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderLeftWidth: 3,
    borderLeftColor: colors.statusSOS,
    marginBottom: space[5],
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.statusSOS,
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
  destructiveLink: {
    paddingVertical: space[1],
  },
  destructiveLinkText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  destructiveLinkTextDanger: {
    color: colors.statusSOS,
  },
});
