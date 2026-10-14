import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { Card } from '@/components/ui/core/Card';
import { Tag } from '@/components/ui/core/Tag';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { colors, space, typography } from '@/constants/tokens';
import { CLINICAL_RULES_DB } from '@/types';
import type { CalibrationEntry, CosmeticProcedureKey } from '@/types';
import { formatMonths } from '@/utils/metabolismCalibration';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalibrationCardProps {
  procedureKey: CosmeticProcedureKey;
  /** The user's calibration for this procedure; absent = clinical default. */
  entry?: CalibrationEntry;
  onReset: () => void;
}

const monthsLabel = (n: number): string => `${n} ${n === 1 ? 'month' : 'months'}`;

function confirmReset(onReset: () => void): void {
  Alert.alert(
    'Reset estimate?',
    'Future procedures will use the clinical default again. Procedures you have already logged keep their dates.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: onReset },
    ],
  );
}

function ValueRow({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Shows the clinical default next to the user's personal estimate for one
 * procedure, with a Reset back to the default (ProcedureDetailScreen).
 */
export function CalibrationCard({ procedureKey, entry, onReset }: CalibrationCardProps) {
  const defaultLabel = monthsLabel(CLINICAL_RULES_DB[procedureKey].totalEffectMonths);

  return (
    <View testID="calibration-card">
      <Card variant="surface" padding="md" style={styles.card}>
        <Text style={styles.heading}>Effect duration</Text>
        {entry ? (
          <>
            <ValueRow label="Clinical default" value={defaultLabel} testID="calibration-default" />
            <ValueRow label="Your estimate" value={`${formatMonths(entry.months)} months`} testID="calibration-estimate" />
            <View style={styles.footer}>
              <View testID="calibration-reports-tag">
                <Tag tone="info">{`${entry.samples} ${entry.samples === 1 ? 'report' : 'reports'}`}</Tag>
              </View>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => confirmReset(onReset)}
                testID="calibration-reset"
              >
                Reset to default
              </Button>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.body}>{`Using the clinical default (${defaultLabel}).`}</Text>
            <View testID="calibration-empty-alert">
              <InlineAlert tone="info">
                When you move this procedure to history, tell us how long it really lasted to personalise future estimates.
              </InlineAlert>
            </View>
          </>
        )}
      </Card>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    gap: space[3],
  },
  heading: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  body: {
    ...typography.body,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'DMSans-Medium',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space[1],
  },
});
