import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/core/BottomSheet';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { Icon } from '@/components/ui/Icon';
import { colors, palette, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizAnswerDef {
  id: string;
  label: string;
}

export interface QuizQuestionDef {
  id: string;
  text: string;
  answers: QuizAnswerDef[];
}

export interface QuizSheetProps<TResult> {
  visible: boolean;
  onDismiss: () => void;
  questions: QuizQuestionDef[];
  scoreAnswers: (answersByQuestionId: Record<string, string>) => TResult;
  onComplete: (result: TResult) => void;
  /** Whether tapping the backdrop (or Android back) dismisses the sheet mid-quiz. Defaults to true. */
  dismissOnBackdrop?: boolean;
}

// Delay between an answer-chip tap and auto-advance — long enough to
// register the selection, short enough not to feel laggy (spec §5).
const AUTO_ADVANCE_MS = 260;

// ─── Sub-components ────────────────────────────────────────────────────────

interface QuizAnswerChipProps {
  answer: QuizAnswerDef;
  selected: boolean;
  onPress: () => void;
}

function QuizAnswerChip({ answer, selected, onPress }: QuizAnswerChipProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={answer.label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.answerChip,
        selected ? styles.answerChipSelected : styles.answerChipUnselected,
        pressed && styles.answerChipPressed,
      ]}
    >
      <Text style={[styles.answerLabel, selected && styles.answerLabelSelected]}>
        {answer.label}
      </Text>
    </Pressable>
  );
}

interface QuizFooterProps {
  showBack: boolean;
  onBack: () => void;
  showResult: boolean;
  onShowResult: () => void;
}

function QuizFooter({ showBack, onBack, showResult, onShowResult }: QuizFooterProps) {
  return (
    <View style={styles.footer}>
      {showBack ? (
        <IconButton
          icon={<Icon name="arrow-left" size={18} color={colors.textSecondary} />}
          label="Back"
          variant="ghost"
          onPress={onBack}
        />
      ) : (
        <View style={styles.footerSpacer} />
      )}

      {showResult ? (
        <Button
          size="lg"
          accessibilityRole="button"
          accessibilityLabel="Show result"
          onPress={onShowResult}
        >
          Show result
        </Button>
      ) : null}
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Generic quiz-flow shell built on the shared `BottomSheet`: progress dots,
 * one question per screen, chip answers that auto-advance, back navigation,
 * and an explicit "Show result" action on the final question. Content-
 * agnostic — `PhototypeQuizSheet`/`SkinTypeQuizSheet` supply the real
 * questions/answers/scoring function.
 */
export function QuizSheet<TResult>({
  visible,
  onDismiss,
  questions,
  scoreAnswers,
  onComplete,
  dismissOnBackdrop = true,
}: QuizSheetProps<TResult>) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPendingAdvance() {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }

  // Answers are transient, component-local state — discarded whenever the
  // sheet closes (spec §5), so re-opening always starts at question 1 with
  // nothing selected.
  useEffect(() => {
    if (!visible) {
      clearPendingAdvance();
      setStepIndex(0);
      setAnswers({});
    }
  }, [visible]);

  useEffect(() => clearPendingAdvance, []);

  const total = questions.length;
  const question = questions[stepIndex];
  const isFinal = stepIndex === total - 1;

  function handleSelectAnswer(answerId: string) {
    if (!question) return;
    setAnswers((prev) => ({ ...prev, [question.id]: answerId }));

    if (isFinal) return; // final question: explicit "Show result" only, no auto-advance

    clearPendingAdvance();
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      setStepIndex((i) => Math.min(i + 1, total - 1));
    }, AUTO_ADVANCE_MS);
  }

  function handleBack() {
    clearPendingAdvance();
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function handleShowResult() {
    onComplete(scoreAnswers(answers));
  }

  if (!question) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onDismiss}
      dismissOnBackdrop={dismissOnBackdrop}
      sizing="auto"
    >
      <View style={styles.container}>
        <View
          style={styles.progressRow}
          accessible
          accessibilityLabel={`Step ${stepIndex + 1} of ${total}`}
        >
          {questions.map((q, i) => (
            <View key={q.id} style={[styles.dot, i === stepIndex && styles.dotActive]} />
          ))}
        </View>

        <Text style={styles.questionText}>{question.text}</Text>

        <View style={styles.answers}>
          {question.answers.map((answer) => (
            <QuizAnswerChip
              key={answer.id}
              answer={answer}
              selected={answers[question.id] === answer.id}
              onPress={() => handleSelectAnswer(answer.id)}
            />
          ))}
        </View>

        <QuizFooter
          showBack={stepIndex > 0}
          onBack={handleBack}
          showResult={isFinal}
          onShowResult={handleShowResult}
        />
      </View>
    </BottomSheet>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingBottom: space[2],
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space[2],
    marginBottom: space[5],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    backgroundColor: palette.plum,
    width: 20,
  },
  questionText: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: space[5],
  },
  answers: {
    gap: space[3],
    marginBottom: space[6],
  },
  answerChip: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: space.hitMin,
    justifyContent: 'center',
  },
  answerChipUnselected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  answerChipSelected: {
    backgroundColor: palette.plumTintLight,
    borderColor: palette.plum,
  },
  answerChipPressed: {
    opacity: 0.8,
  },
  answerLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  answerLabelSelected: {
    color: palette.plum,
    fontFamily: 'DMSans-Medium',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerSpacer: {
    width: 44,
    height: 44,
  },
});
