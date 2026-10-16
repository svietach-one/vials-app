import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CalibrationCard } from '@/components/clinic/CalibrationCard';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { Input } from '@/components/ui/forms/Input';
import { Textarea } from '@/components/ui/forms/Textarea';
import { colors, space, typography } from '@/constants/tokens';
import { resetCalibration } from '@/domain/procedureActions';
import type { ClinicStackParamList } from '@/navigation/AppNavigator';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProfileStore } from '@/store/profileStore';
import { formatIsoToDateInput, parseDateInput, todayLocalIso } from '@/utils/dateInput';
import { getProcedureDisplayName } from '@/utils/procedureLifespanHelpers';

type Props = NativeStackScreenProps<ClinicStackParamList, 'ProcedureDetail'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProcedureDetailScreen({ route, navigation }: Props) {
  const { procedureId } = route.params;
  const procedures = useProceduresStore((s) => s.procedures);
  const updateProcedure = useProceduresStore((s) => s.updateProcedure);
  const individualDurations = useProfileStore((s) => s.profile?.individualDurationMonths);

  const proc = procedures.find((p) => p.id === procedureId) ?? null;

  const [dateText, setDateText] = useState(proc ? formatIsoToDateInput(proc.datePerformed) : '');
  const [note, setNote] = useState(proc?.note ?? '');
  const [dateError, setDateError] = useState<string | null>(null);
  const [estimateReset, setEstimateReset] = useState(false);

  function handleSave() {
    if (!proc) return;
    const iso = parseDateInput(dateText);
    if (!iso) {
      setDateError('Enter a valid date in DD/MM/YYYY format');
      return;
    }
    if (iso > todayLocalIso()) {
      setDateError('Date cannot be in the future');
      return;
    }
    const trimmed = note.trim();
    updateProcedure(proc.id, {
      datePerformed: iso,
      note: trimmed.length > 0 ? trimmed : undefined,
    });
    navigation.goBack();
  }

  const backButton = (
    <IconButton
      icon={<Icon name="arrow-left" size={20} color={colors.textPrimary} />}
      label="Back"
      variant="ghost"
      size="sm"
      onPress={() => navigation.goBack()}
    />
  );

  if (!proc) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader title="Details" leftAction={backButton} />
        <View style={styles.missing}>
          <Text style={styles.missingText}>This procedure is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Custom procedures have no stable category key, so they are never calibrated.
  const calibrationKey = proc.procedureKey === 'custom' ? null : proc.procedureKey;

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader title="Details" leftAction={backButton} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.procName}>{getProcedureDisplayName(proc)}</Text>

          <Input
            label="DATE PERFORMED"
            value={dateText}
            onChangeText={(t) => {
              setDateText(t);
              if (dateError) setDateError(null);
            }}
            placeholder="DD/MM/YYYY"
            keyboardType="numbers-and-punctuation"
            error={dateError}
            returnKeyType="done"
          />

          <Textarea
            label="NOTE"
            value={note}
            onChangeText={setNote}
            placeholder="Add a comment about this procedure…"
            minHeight={120}
          />

          {calibrationKey ? (
            <CalibrationCard
              procedureKey={calibrationKey}
              entry={individualDurations?.[calibrationKey]}
              onReset={() => {
                resetCalibration(calibrationKey);
                setEstimateReset(true);
              }}
            />
          ) : null}

          {estimateReset ? (
            <View testID="estimate-reset-notice">
              <InlineAlert tone="safe">Estimate reset to the clinical default.</InlineAlert>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button variant="primary" size="lg" fullWidth onPress={handleSave}>
            Save
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[4],
    gap: space[5],
  },
  procName: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  footer: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[3],
    paddingBottom: space[2],
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[8],
  },
  missingText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
