import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { CLINICAL_RULES_DB } from '@/types';
import { useProceduresStore } from '@/store/proceduresStore';
import { ConflictEngine } from '@/utils/conflictEngine';
import type { CosmeticProcedureKey, UserProcedureLog } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROCEDURE_LABELS: Record<CosmeticProcedureKey, string> = {
  botox: 'Botox',
  fillers: 'Dermal fillers',
  smas_lifting: 'SMAS lifting',
  mesotherapy: 'Mesotherapy',
  chemical_peel_deep: 'Deep chemical peel',
  mechanical_facial: 'Mechanical facial',
};

function isInRehabWindow(
  proc: UserProcedureLog,
): proc is UserProcedureLog & { procedureKey: CosmeticProcedureKey } {
  // Custom procedures have no clinical rehab rules or restrictions
  if (proc.procedureKey === 'custom') return false;
  if (proc.status !== 'rehab') return false;
  const config = CLINICAL_RULES_DB[proc.procedureKey];
  const performed = new Date(proc.datePerformed);
  const rehabEnd = new Date(performed);
  rehabEnd.setDate(rehabEnd.getDate() + config.rehabDays);
  return new Date() <= rehabEnd;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders lifestyle restrictions for procedures currently in their rehab window.
 * Returns null when there are no active rehab procedures.
 */
export function ClinicalRestrictionsBlock() {
  const procedures = useProceduresStore((s) => s.procedures);
  const rehabProcs = procedures.filter(isInRehabWindow);

  if (rehabProcs.length === 0) return null;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Feather name="shield" size={14} color={palette.cabernet} />
        <Text style={styles.headerText}>Rehab restrictions</Text>
      </View>

      {rehabProcs.map((proc) => {
        const restrictions = ConflictEngine.getRehabRestrictions(proc.procedureKey);
        const label = PROCEDURE_LABELS[proc.procedureKey];

        return (
          <View key={proc.id} style={styles.section}>
            <Text style={styles.procName}>{label}</Text>

            {/* Restriction rows — Cabernet */}
            {restrictions.map((text, i) => (
              <View key={i} style={styles.row}>
                <Feather name="x-circle" size={13} color={palette.cabernet} style={styles.rowIcon} />
                <Text style={styles.restrictionText}>{text}</Text>
              </View>
            ))}

            {/* Safe row — bottleGreen */}
            <View style={styles.row}>
              <Feather name="check-circle" size={13} color={palette.bottleGreen} style={styles.rowIcon} />
              <Text style={[styles.restrictionText, styles.safeText]}>
                Gentle cleanser and barrier moisturizer OK
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.statusSOSTint,
    borderWidth: 1,
    borderColor: colors.statusSOSLine,
    borderRadius: radius.md,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    gap: space[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  headerText: {
    ...typography.label,
    color: palette.cabernet,
  },

  section: {
    gap: space[2],
  },
  procName: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.cabernet,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
  },
  rowIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  restrictionText: {
    ...typography.bodySmall,
    color: palette.cabernet,
    flex: 1,
  },
  safeText: {
    color: palette.bottleGreen,
  },
});
