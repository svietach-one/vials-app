import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { Input } from '@/components/ui/forms/Input';
import { colors, radius, space, typography } from '@/constants/tokens';
import type { ClinicStackParamList } from '@/navigation/AppNavigator';
import { useProceduresStore } from '@/store/proceduresStore';
import { formatIsoToDateInput, parseDateInput } from '@/utils/dateInput';
import { getProcedureDisplayName } from '@/utils/procedureLifespanHelpers';

type Props = NativeStackScreenProps<ClinicStackParamList, 'ProcedureDetail'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProcedureDetailScreen({ route, navigation }: Props) {
  const { procedureId } = route.params;
  const procedures = useProceduresStore((s) => s.procedures);
  const updateProcedure = useProceduresStore((s) => s.updateProcedure);

  const proc = procedures.find((p) => p.id === procedureId) ?? null;

  const [dateText, setDateText] = useState(proc ? formatIsoToDateInput(proc.datePerformed) : '');
  const [note, setNote] = useState(proc?.note ?? '');
  const [dateError, setDateError] = useState<string | null>(null);

  function handleSave() {
    if (!proc) return;
    const iso = parseDateInput(dateText);
    if (!iso) {
      setDateError('Enter a valid date in DD/MM/YYYY format');
      return;
    }
    if (new Date(iso) > new Date()) {
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

          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>NOTE</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a comment about this procedure…"
              placeholderTextColor={colors.textTertiary}
              style={styles.noteInput}
              multiline
              textAlignVertical="top"
            />
          </View>
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
  noteBlock: {
    gap: 7,
  },
  noteLabel: {
    ...typography.label,
    color: colors.textPrimary,
  },
  noteInput: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    paddingHorizontal: space[3] + 2,
    paddingVertical: space[3],
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
