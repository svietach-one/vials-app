import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { Input } from '@/components/ui/forms/Input';
import { Button } from '@/components/ui/core/Button';
import { FilterChip } from '@/components/ui/core/FilterChip';
import { IconButton } from '@/components/ui/core/IconButton';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { useProfileStore } from '@/store/profileStore';
import { ConflictEngine } from '@/utils/conflictEngine';
import { parseDateInput } from '@/utils/dateInput';
import { generateId } from '@/utils/generateId';
import { PROCEDURE_LABELS } from '@/utils/procedureLifespanHelpers';
import { CLINICAL_RULES_DB } from '@/types';
import type {
  CosmeticProcedureKey,
  ProcedureLogKey,
  TreatmentZone,
  UserProcedureLog,
} from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_OPTIONS: { key: CosmeticProcedureKey; label: string; meta: string }[] = (
  Object.keys(CLINICAL_RULES_DB) as CosmeticProcedureKey[]
).map((key) => {
  const config = CLINICAL_RULES_DB[key];
  return {
    key,
    label: PROCEDURE_LABELS[key],
    meta: `${config.rehabDays}d rehab · ${config.totalEffectMonths}mo effect`,
  };
});

const PROCEDURE_OPTIONS: { key: ProcedureLogKey; label: string; meta: string }[] = [
  ...PRESET_OPTIONS,
  { key: 'custom', label: 'Custom Procedure', meta: 'Your own name · your own timeline' },
];

/**
 * Single-tap symptom presets resolving the mandatory recovery window for
 * custom procedures (research §1.5 V2). 'manual' opens a day input.
 */
type SymptomPresetKey = 'light_care' | 'redness' | 'trauma' | 'manual';

const SYMPTOM_PRESETS: { key: SymptomPresetKey; label: string; meta: string; days: number | null }[] = [
  { key: 'light_care', label: 'Light Care', meta: 'Hydration, massage, mask — no downtime', days: 0 },
  { key: 'redness', label: 'Redness / Peeling', meta: 'Mild barrier disruption — 3 days', days: 3 },
  { key: 'trauma', label: 'Trauma / Laser', meta: 'Micro-needling, deep peel, injections — 7 days', days: 7 },
  { key: 'manual', label: 'Custom', meta: 'Set your own downtime in days', days: null },
];

const ZONE_OPTIONS: { key: TreatmentZone; label: string }[] = [
  { key: 'face', label: 'Face' },
  { key: 'neck', label: 'Neck' },
  { key: 'decollete', label: 'Décolleté' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddProcedureModalProps {
  visible: boolean;
  /** Existing procedures used for collision detection. */
  procedures: UserProcedureLog[];
  onClose: () => void;
  onSave: (log: UserProcedureLog) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayFormatted(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddProcedureModal({
  visible,
  procedures,
  onClose,
  onSave,
}: AddProcedureModalProps) {
  const profile = useProfileStore((s) => s.profile);

  const [selectedKey, setSelectedKey] = useState<ProcedureLogKey>('botox');
  const [dateText, setDateText] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customNameError, setCustomNameError] = useState<string | null>(null);
  const [returnDateText, setReturnDateText] = useState('');
  const [returnDateError, setReturnDateError] = useState<string | null>(null);
  const [symptomPreset, setSymptomPreset] = useState<SymptomPresetKey | null>(null);
  const [manualDaysText, setManualDaysText] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [zones, setZones] = useState<TreatmentZone[]>(['face']);

  const isCustom = selectedKey === 'custom';

  // Reset on open
  useEffect(() => {
    if (visible) {
      setSelectedKey('botox');
      setDateText(todayFormatted());
      setDateError(null);
      setCustomName('');
      setCustomNameError(null);
      setReturnDateText('');
      setReturnDateError(null);
      setSymptomPreset(null);
      setManualDaysText('');
      setRecoveryError(null);
      setZones(['face']);
    }
  }, [visible]);

  function toggleZone(zone: TreatmentZone) {
    setZones((current) => {
      if (current.includes(zone)) {
        // At least one zone must stay selected
        return current.length > 1 ? current.filter((z) => z !== zone) : current;
      }
      return [...current, zone];
    });
  }

  // ── Conflict checks (reactive; presets only — custom has no clinical mappings) ──

  const activeProcedures = procedures
    .filter((p) => p.status !== 'archived')
    .map((p) => ({ procedureKey: p.procedureKey, datePerformed: p.datePerformed }));

  const collisionResult = useMemo(
    () => (isCustom ? null : ConflictEngine.checkProcedureCollision(selectedKey, activeProcedures)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedKey, procedures],
  );

  const seasonalResult = useMemo(
    () => (isCustom ? null : ConflictEngine.checkSeasonalConflict(selectedKey)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedKey],
  );

  const phototypeResult = useMemo(
    () => (isCustom ? null : ConflictEngine.checkPhototypeConflict(selectedKey, profile?.phototype ?? null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedKey, profile?.phototype],
  );

  const pregnancyResult = useMemo(
    () =>
      isCustom
        ? null
        : ConflictEngine.checkPregnancyConflict(selectedKey, profile?.pregnantOrBreastfeeding ?? false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedKey, profile?.pregnantOrBreastfeeding],
  );

  // Memoized element (not just the data): the mount-time reset effect below
  // commits twice (initial state, then its own batched setState calls), and
  // botox — the default selection — is itself an avoid-severity procedure, so
  // unlike the three pre-existing checks (all null for the untouched default)
  // this alert can be non-null on that very first commit. Caching the element
  // itself lets React bail out of re-invoking InlineAlert on the second,
  // data-unchanged commit instead of rendering the identical alert twice.
  const pregnancyAlert = useMemo(() => {
    if (!pregnancyResult) return null;
    return (
      <InlineAlert
        tone={pregnancyResult.severity === 'avoid' ? 'sos' : 'warning'}
        icon={
          <Icon
            name="alert-circle"
            size={14}
            color={pregnancyResult.severity === 'avoid' ? colors.statusSOS : colors.statusWarningAccent}
          />
        }
        title="Pregnancy / breastfeeding advisory"
      >
        {`${pregnancyResult.explanation}\n\n${pregnancyResult.suggestion}`}
      </InlineAlert>
    );
  }, [pregnancyResult]);

  // ── Save ──────────────────────────────────────────────────────────────────

  function handleSave() {
    const isoDate = parseDateInput(dateText);
    if (!isoDate) {
      setDateError('Enter a valid date in DD/MM/YYYY format');
      return;
    }
    if (new Date(isoDate) > new Date()) {
      setDateError('Date cannot be in the future');
      return;
    }
    setDateError(null);

    if (isCustom) {
      const name = customName.trim();
      if (!name) {
        setCustomNameError('Enter a name for this procedure');
        return;
      }
      setCustomNameError(null);

      // Resolve the recovery window from the symptom preset / manual input
      let rehabDays: number | null = null;
      if (symptomPreset === 'manual') {
        const parsed = Number(manualDaysText.trim());
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > 90) {
          setRecoveryError('Enter the downtime in days (0–90)');
          return;
        }
        rehabDays = parsed;
      } else if (symptomPreset) {
        rehabDays = SYMPTOM_PRESETS.find((p) => p.key === symptomPreset)?.days ?? null;
      }

      // Return date: optional, but the recovery window is mandatory —
      // rehab days and/or a next-procedure date (research §1.5 V2)
      let isoReturnDate: string | null = null;
      if (returnDateText.trim()) {
        isoReturnDate = parseDateInput(returnDateText);
        if (!isoReturnDate) {
          setReturnDateError('Enter a valid date in DD/MM/YYYY format');
          return;
        }
        if (isoReturnDate <= isoDate) {
          setReturnDateError('Must be after the date performed');
          return;
        }
      }
      setReturnDateError(null);

      if (rehabDays === null && !isoReturnDate) {
        setRecoveryError('Choose a recovery preset or set the estimated return date');
        return;
      }
      setRecoveryError(null);

      onSave({
        id: generateId(),
        procedureKey: 'custom',
        customName: name,
        ...(rehabDays !== null ? { customRehabDays: rehabDays } : {}),
        ...(isoReturnDate ? { estimatedReturnDate: isoReturnDate } : {}),
        affectedZones: zones,
        datePerformed: isoDate,
        // A resolved downtime > 0 starts inside the rehab window
        status: rehabDays !== null && rehabDays > 0 ? 'rehab' : 'active',
        deferralCount: 0,
      });
      return;
    }

    const log: UserProcedureLog = {
      id: generateId(),
      procedureKey: selectedKey,
      affectedZones: zones,
      datePerformed: isoDate,
      status: 'rehab',
      deferralCount: 0,
    };

    onSave(log);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.safe}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Log Procedure</Text>
            <IconButton
              icon={<Icon name="x" size={20} color={colors.textSecondary} />}
              label="Close"
              variant="secondary"
              size="sm"
              onPress={onClose}
            />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Procedure selector */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Procedure</Text>
              {PROCEDURE_OPTIONS.map((opt) => {
                const active = selectedKey === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setSelectedKey(opt.key)}
                    style={({ pressed }) => [
                      optStyles.row,
                      active && optStyles.rowActive,
                      pressed && optStyles.rowPressed,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={optStyles.content}>
                      <Text style={[optStyles.label, active && optStyles.labelActive]}>
                        {opt.label}
                      </Text>
                      <Text style={[optStyles.meta, active && optStyles.metaActive]}>
                        {opt.meta}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom procedure name */}
            {isCustom ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Procedure Name</Text>
                <Input
                  value={customName}
                  onChangeText={(t) => { setCustomName(t); if (customNameError) setCustomNameError(null); }}
                  placeholder="e.g. Laser Resurfacing"
                  error={customNameError}
                  returnKeyType="done"
                />
              </View>
            ) : null}

            {/* Date performed */}
            <View style={styles.section}>
              <View style={styles.dateHeader}>
                <Text style={styles.sectionLabel}>Date Performed</Text>
                <Button
                  variant="textActive"
                  size="sm"
                  onPress={() => { setDateText(todayFormatted()); setDateError(null); }}
                  accessibilityLabel="Fill today's date"
                >
                  Today
                </Button>
              </View>
              <Input
                value={dateText}
                onChangeText={(t) => { setDateText(t); if (dateError) setDateError(null); }}
                placeholder="DD / MM / YYYY"
                keyboardType="numbers-and-punctuation"
                error={dateError}
                returnKeyType="done"
              />
            </View>

            {/* Recovery window (custom only — mandatory via preset and/or return date) */}
            {isCustom ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Recovery Window</Text>
                {SYMPTOM_PRESETS.map((preset) => {
                  const active = symptomPreset === preset.key;
                  return (
                    <Pressable
                      key={preset.key}
                      onPress={() => {
                        setSymptomPreset(active ? null : preset.key);
                        setRecoveryError(null);
                      }}
                      style={({ pressed }) => [
                        optStyles.row,
                        active && optStyles.rowActive,
                        pressed && optStyles.rowPressed,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <View style={optStyles.content}>
                        <Text style={[optStyles.label, active && optStyles.labelActive]}>
                          {preset.label}
                        </Text>
                        <Text style={[optStyles.meta, active && optStyles.metaActive]}>
                          {preset.meta}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                {symptomPreset === 'manual' ? (
                  <Input
                    value={manualDaysText}
                    onChangeText={(t) => { setManualDaysText(t); setRecoveryError(null); }}
                    placeholder="Downtime in days, e.g. 5"
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                ) : null}
                {recoveryError ? <Text style={styles.errorText}>{recoveryError}</Text> : null}
              </View>
            ) : null}

            {/* Treated zones */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Treated Zones</Text>
              <View style={styles.zoneRow}>
                {ZONE_OPTIONS.map(({ key, label }) => (
                  <FilterChip
                    key={key}
                    selected={zones.includes(key)}
                    onPress={() => toggleZone(key)}
                    accessibilityLabel={`${label} zone`}
                  >
                    {label}
                  </FilterChip>
                ))}
              </View>
              <Text style={styles.fieldHint}>
                Routines are face routines — a procedure that does not touch the face never pauses your products.
              </Text>
            </View>

            {/* Estimated return date (custom only) */}
            {isCustom ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Estimated Return Date</Text>
                <Input
                  value={returnDateText}
                  onChangeText={(t) => { setReturnDateText(t); if (returnDateError) setReturnDateError(null); setRecoveryError(null); }}
                  placeholder="DD / MM / YYYY (optional with a preset)"
                  keyboardType="numbers-and-punctuation"
                  error={returnDateError}
                  returnKeyType="done"
                />
                <Text style={styles.fieldHint}>
                  When you expect to repeat this procedure — used to estimate the effect lifespan and fading window.
                </Text>
              </View>
            ) : null}

            {/* Warnings */}
            {collisionResult ? (
              <InlineAlert
                tone={collisionResult.severity === 'avoid' ? 'sos' : 'warning'}
                icon={<Icon name="alert-triangle" size={14} color={collisionResult.severity === 'avoid' ? colors.statusSOS : colors.statusWarningAccent} />}
                title="Procedure conflict"
              >
                {`${collisionResult.explanation}\n\n${collisionResult.suggestion}`}
              </InlineAlert>
            ) : null}

            {seasonalResult ? (
              <InlineAlert
                tone={seasonalResult.severity === 'avoid' ? 'sos' : 'warning'}
                icon={<Icon name="sun" size={14} color={seasonalResult.severity === 'avoid' ? colors.statusSOS : colors.statusWarningAccent} />}
                title="Seasonal caution"
              >
                {`${seasonalResult.explanation}\n\n${seasonalResult.suggestion}`}
              </InlineAlert>
            ) : null}

            {phototypeResult ? (
              <InlineAlert
                tone="warning"
                icon={<Icon name="info" size={14} color={colors.statusWarningAccent} />}
                title="Skin tone consideration"
              >
                {`${phototypeResult.explanation}\n\n${phototypeResult.suggestion}`}
              </InlineAlert>
            ) : null}

            {pregnancyAlert}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button fullWidth size="lg" onPress={handleSave}>
              Log Procedure
            </Button>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
  },
  headerTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[4],
    paddingBottom: space[6],
    gap: space[5],
  },
  section: {
    gap: space[3],
  },
  // Matches the Input component's default field label
  sectionLabel: {
    ...typography.label,
    color: colors.textPrimary,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayLink: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.bottleGreen,
  },
  fieldHint: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  errorText: {
    ...typography.caption,
    color: colors.statusError,
  },
  zoneRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  footer: {
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
    backgroundColor: colors.bgBase,
  },
});

const optStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    backgroundColor: colors.bgBase,
  },
  rowActive: {
    borderColor: palette.plum,
    backgroundColor: palette.plumTintLight,
  },
  rowPressed: {
    backgroundColor: palette.plumTintLight,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
  },
  labelActive: {
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  // Same darker gray as ReplaceStepSheet's selected-row secondary text
  // (optionBrand) — the light tertiary gray reads too faint once the card
  // itself is already highlighted (plum border + tint).
  metaActive: {
    color: colors.textSecondary,
  },
});
