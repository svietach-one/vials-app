import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { Input } from '@/components/ui/forms/Input';
import { RadioOptionGroup, type RadioOption } from '@/components/ui/forms/RadioOptionGroup';
import { colors, radius, shadow, space, typography } from '@/constants/tokens';
import type { UserProcedureLog } from '@/types';
import {
  formatMonths,
  MAX_REPORTED_MONTHS,
  MIN_REPORTED_MONTHS,
  parseReportedMonthsText,
} from '@/utils/metabolismCalibration';
import { getProcedureDisplayName, getTimelineConfig } from '@/utils/procedureLifespanHelpers';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcedureDurationFeedbackModalProps {
  /** Passing null hides the modal. */
  proc: UserProcedureLog | null;
  /** `null` means "skip" - archive without calibrating. */
  onConfirm: (reportedMonths: number | null) => void;
  onCancel: () => void;
}

type DurationChoice = 'expected' | 'different' | 'skip';

const RANGE_ERROR = `Enter ${MIN_REPORTED_MONTHS}–${MAX_REPORTED_MONTHS} months.`;

function buildOptions(expectedMonths: number): RadioOption<DurationChoice>[] {
  return [
    {
      value: 'expected',
      label: 'About as expected',
      sublabel: `Around ${formatMonths(expectedMonths)} months`,
    },
    { value: 'different', label: 'A different length' },
    { value: 'skip', label: 'Skip' },
  ];
}

function CustomMonthsField({
  text,
  onChangeText,
  showError,
}: {
  text: string;
  onChangeText: (t: string) => void;
  showError: boolean;
}) {
  return (
    <View style={styles.inputBlock}>
      <Input
        value={text}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="e.g. 4.5"
        suffix="months"
        returnKeyType="done"
        testID="duration-input"
      />
      {showError ? (
        <Text style={styles.error} testID="duration-error">
          {RANGE_ERROR}
        </Text>
      ) : null}
    </View>
  );
}

// ─── State ────────────────────────────────────────────────────────────────────

function useDurationAnswer(
  proc: UserProcedureLog | null,
  onConfirm: (reportedMonths: number | null) => void,
) {
  const [choice, setChoice] = useState<DurationChoice>('skip');
  const [text, setText] = useState('');

  // A previous half-finished answer must not leak into the next procedure.
  useEffect(() => {
    setChoice('skip');
    setText('');
  }, [proc?.id]);

  const expectedMonths = proc ? getTimelineConfig(proc).totalEffectMonths : 0;
  const parsed = parseReportedMonthsText(text);
  const isCustomInvalid = choice === 'different' && !parsed.ok;

  function confirm() {
    if (choice === 'skip') onConfirm(null);
    else if (choice === 'expected') onConfirm(expectedMonths);
    else if (parsed.ok) onConfirm(parsed.months);
  }

  return {
    choice,
    setChoice,
    text,
    setText,
    expectedMonths,
    isCustomInvalid,
    showError: isCustomInvalid && text.trim() !== '',
    confirm,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Asked when a pre-defined procedure is moved to history: how long did the
 * effect really last? The answer feeds the personal duration estimate. Skip is
 * the default so dismissing the question never costs the user a decision.
 */
export function ProcedureDurationFeedbackModal({
  proc,
  onConfirm,
  onCancel,
}: ProcedureDurationFeedbackModalProps) {
  const a = useDurationAnswer(proc, onConfirm);

  return (
    <Modal
      visible={proc !== null}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      testID="duration-feedback-modal"
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.backdrop} onPress={onCancel} testID="duration-feedback-backdrop">
        {/* Stop propagation so tapping the sheet doesn't close the modal */}
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>How long did the effect last?</Text>
          <Text style={styles.body}>
            {proc ? `Your answer tunes the estimate for your next ${getProcedureDisplayName(proc)}.` : ''}
          </Text>
          <RadioOptionGroup options={buildOptions(a.expectedMonths)} value={a.choice} onChange={a.setChoice} />
          {a.choice === 'different' ? (
            <CustomMonthsField text={a.text} onChangeText={a.setText} showError={a.showError} />
          ) : null}
          <View style={styles.actions}>
            <Button variant="secondary" size="lg" onPress={onCancel} style={styles.btn} testID="duration-cancel">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              onPress={a.confirm}
              disabled={a.isCustomInvalid}
              style={styles.btn}
              testID="duration-confirm"
            >
              Confirm
            </Button>
          </View>
        </View>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    color: colors.textSecondary,
  },
  inputBlock: {
    gap: space[2],
  },
  error: {
    ...typography.bodySmall,
    color: colors.statusError,
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
