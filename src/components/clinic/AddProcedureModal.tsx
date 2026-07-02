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
import { Feather } from '@expo/vector-icons';

import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { Input } from '@/components/ui/forms/Input';
import { Button } from '@/components/ui/core/Button';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { useProfileStore } from '@/store/profileStore';
import { ConflictEngine } from '@/utils/conflictEngine';
import { generateId } from '@/utils/generateId';
import { CLINICAL_RULES_DB } from '@/types';
import type { CosmeticProcedureKey, UserProcedureLog } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROCEDURE_OPTIONS: {
  key: CosmeticProcedureKey;
  label: string;
  rehabDays: number;
  totalMonths: number;
}[] = [
  { key: 'botox',             label: 'Botox / Dysport',    rehabDays: 7,  totalMonths: 6  },
  { key: 'fillers',           label: 'Dermal Fillers',     rehabDays: 14, totalMonths: 12 },
  { key: 'smas_lifting',      label: 'SMAS Lifting',       rehabDays: 14, totalMonths: 18 },
  { key: 'mesotherapy',       label: 'Mesotherapy',        rehabDays: 5,  totalMonths: 6  },
  { key: 'chemical_peel_deep',label: 'Deep Chemical Peel', rehabDays: 14, totalMonths: 3  },
  { key: 'mechanical_facial', label: 'Mechanical Facial',  rehabDays: 3,  totalMonths: 1  },
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

/** Parses DD/MM/YYYY → YYYY-MM-DD ISO date string, or null on failure. */
function parseDateInput(text: string): string | null {
  const match = text.trim().replace(/\s/g, '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const d = parseInt(dd, 10);
  const m = parseInt(mm, 10);
  const y = parseInt(yyyy, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000) return null;
  const date = new Date(y, m - 1, d);
  // JS Date rolls overflow dates (e.g. April 31 → May 1); reject those
  if (isNaN(date.getTime()) || date.getDate() !== d || date.getMonth() + 1 !== m) return null;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

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

  const [selectedKey, setSelectedKey] = useState<CosmeticProcedureKey>('botox');
  const [dateText, setDateText] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setSelectedKey('botox');
      setDateText(todayFormatted());
      setDateError(null);
    }
  }, [visible]);

  // ── Conflict checks (reactive) ────────────────────────────────────────────

  const activeProcedures = procedures
    .filter((p) => p.status !== 'archived')
    .map((p) => ({ procedureKey: p.procedureKey, datePerformed: p.datePerformed }));

  const collisionResult = useMemo(
    () => ConflictEngine.checkProcedureCollision(selectedKey, activeProcedures),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedKey, procedures],
  );

  const seasonalResult = useMemo(
    () => ConflictEngine.checkSeasonalConflict(selectedKey),
    [selectedKey],
  );

  const phototypeResult = useMemo(
    () => ConflictEngine.checkPhototypeConflict(selectedKey, profile?.phototype ?? null),
    [selectedKey, profile?.phototype],
  );

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

    const log: UserProcedureLog = {
      id: generateId(),
      procedureKey: selectedKey,
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
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
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
                    style={[optStyles.row, active && optStyles.rowActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[optStyles.radio, active && optStyles.radioActive]}>
                      {active ? <View style={optStyles.radioDot} /> : null}
                    </View>
                    <View style={optStyles.content}>
                      <Text style={[optStyles.label, active && optStyles.labelActive]}>
                        {opt.label}
                      </Text>
                      <Text style={optStyles.meta}>
                        {`${opt.rehabDays}d rehab · ${opt.totalMonths}mo effect`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Date performed */}
            <View style={styles.section}>
              <View style={styles.dateHeader}>
                <Text style={styles.sectionLabel}>Date Performed</Text>
                <Pressable
                  onPress={() => { setDateText(todayFormatted()); setDateError(null); }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Fill today's date"
                >
                  <Text style={styles.todayLink}>Today</Text>
                </Pressable>
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

            {/* Warnings */}
            {collisionResult ? (
              <InlineAlert
                tone={collisionResult.severity === 'avoid' ? 'sos' : 'warning'}
                icon={<Feather name="alert-triangle" size={14} color={collisionResult.severity === 'avoid' ? colors.statusSOS : colors.statusWarning} />}
                title="Procedure conflict"
              >
                {`${collisionResult.explanation}\n\n${collisionResult.suggestion}`}
              </InlineAlert>
            ) : null}

            {seasonalResult ? (
              <InlineAlert
                tone={seasonalResult.severity === 'avoid' ? 'sos' : 'warning'}
                icon={<Feather name="sun" size={14} color={seasonalResult.severity === 'avoid' ? colors.statusSOS : colors.statusWarning} />}
                title="Seasonal caution"
              >
                {`${seasonalResult.explanation}\n\n${seasonalResult.suggestion}`}
              </InlineAlert>
            ) : null}

            {phototypeResult ? (
              <InlineAlert
                tone="warning"
                icon={<Feather name="info" size={14} color={colors.statusWarning} />}
                title="Skin tone consideration"
              >
                {`${phototypeResult.explanation}\n\n${phototypeResult.suggestion}`}
              </InlineAlert>
            ) : null}
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
  sectionLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: colors.textSecondary,
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    backgroundColor: colors.bgBase,
  },
  rowActive: {
    borderColor: palette.black,
    backgroundColor: colors.bgSubtle,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioActive: {
    borderColor: palette.black,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.black,
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
});
