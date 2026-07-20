import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/core/Button';
import { reasonText } from '@/constants/decisionReasons';
import { SlotAlternativeRow } from '@/components/routine/SlotAlternativeRow';
import { colors, radius, space, typography } from '@/constants/tokens';
import type { PlanCommitScope } from '@/domain/routinePlanActions';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import type { RoutinePlan } from '@/utils/routineEngine/generate';
import { buildDraftSummaryLines } from '@/utils/routineEngine/planApply';
import type { PlannedStep, SlotAlternative } from '@/utils/routineEngine/planTypes';
import type { PlanDiffEntry } from '@/utils/routineEngine/validate';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftPreviewSheetProps {
  visible: boolean;
  onClose: () => void;
  plan: RoutinePlan | null;
  diff: PlanDiffEntry[];
  onCommit: (scope: PlanCommitScope) => void;
  /**
   * Story 2 (routine-similar-product-priority): fired when the user taps a
   * SlotAlternativeRow's swap action. The sheet never applies the swap
   * itself — RoutinesScreen owns rewriting the still-uncommitted draft via
   * `applySlotAlternativeSwap` (tech design §1). Optional so pre-existing
   * callers/tests that predate this feature keep typechecking.
   */
  onSwapAlternative?: (winnerProductId: string, chosenProductId: string) => void;
  /**
   * Fired when the user taps "Add anyway" on a reserved product (phase-07
   * override). The sheet never applies it — RoutinesScreen records the override
   * and regenerates the draft. Optional so older callers keep typechecking.
   */
  onOverride?: (productId: string) => void;
}

const SNAP_POINTS = ['88%'];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Draft Preview (Diff Mode, research §3): a Before → After layout with at
 * most three quiet summary lines and the four-way commit scope. Nothing here
 * writes — the commit callback routes through routinePlanActions.
 */
export function DraftPreviewSheet({
  visible,
  onClose,
  plan,
  diff,
  onCommit,
  onSwapAlternative,
  onOverride,
}: DraftPreviewSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const wasPresented = useRef(false);

  const products = useProductsStore((s) => s.products);
  const routines = useRoutinesStore((s) => s.routines);

  // Only dismiss after a real present — see AddToRoutineSheet for the
  // modal-stack corruption this guards against.
  useEffect(() => {
    if (visible) {
      wasPresented.current = true;
      sheetRef.current?.present();
    } else if (wasPresented.current) {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...backdropProps}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.45}
      />
    ),
    [],
  );

  if (!plan) return null;

  const nameOf = (productId: string | null) =>
    (productId && products.find((p) => p.id === productId)?.name) ?? 'Unknown product';
  const summaryLines = buildDraftSummaryLines(plan, diff, products);

  const beforeFor = (timeOfDay: 'morning' | 'evening') =>
    routines
      .filter((r) => r.timeOfDay === timeOfDay)
      .flatMap((r) => r.steps.filter((s) => !s.hidden && s.productId))
      .map((s) => nameOf(s.productId));

  // Story 2 (routine-similar-product-priority): same-slot losers, keyed by
  // the winning step's productId, scoped to one period — a winner's
  // alternatives never bleed into the other period's After column.
  const alternativesFor = (period: 'morning' | 'evening'): Map<string, SlotAlternative['alternatives']> =>
    new Map(
      (plan.slotAlternatives ?? [])
        .filter((a) => a.period === period)
        .map((a) => [a.winnerProductId, a.alternatives]),
    );

  // Every frozen item gets a row — clinical pauses with their expiry date,
  // pair-rule freezes with the human reason text (nothing vanishes silently, §1.8)
  const pausedRows = plan.frozen.map((f) => ({
    key: f.productId,
    text: f.until
      ? `${nameOf(f.productId)} — paused until ${f.until}`
      : `${nameOf(f.productId)} — ${reasonText(f.reasonCode)}`,
  }));

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      onDismiss={onClose}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[6] }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Routine Draft</Text>

        {summaryLines.length > 0 ? (
          <View style={styles.summary}>
            {summaryLines.map((line) => (
              <View key={line} style={styles.summaryRow}>
                <Feather name="check" size={14} color={colors.statusSafe} />
                <Text style={styles.summaryText}>{line}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <PeriodDiff
          label="Morning"
          before={beforeFor('morning')}
          afterSteps={plan.periods.morning}
          nameOf={nameOf}
          alternativesByWinner={alternativesFor('morning')}
          onSwapAlternative={onSwapAlternative}
        />
        <PeriodDiff
          label="Evening"
          before={beforeFor('evening')}
          afterSteps={plan.periods.evening}
          nameOf={nameOf}
          alternativesByWinner={alternativesFor('evening')}
          onSwapAlternative={onSwapAlternative}
        />

        {pausedRows.length > 0 ? (
          <View style={styles.pausedBlock}>
            {pausedRows.map((row) => (
              <Text key={row.key} style={styles.pausedText}>
                {row.text}
              </Text>
            ))}
          </View>
        ) : null}

        {plan.reserve.length > 0 ? (
          <View style={styles.pausedBlock}>
            <Text style={styles.reserveHeading}>In reserve</Text>
            {plan.reserve.map((item) => (
              <View key={item.productId} style={styles.reserveRow}>
                <View style={styles.reserveTextWrap}>
                  <Text style={styles.reserveName}>{nameOf(item.productId)}</Text>
                  <Text style={styles.pausedText}>{reasonText(item.reasonCode)}</Text>
                </View>
                {onOverride ? (
                  <Pressable
                    onPress={() => onOverride(item.productId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${nameOf(item.productId)} anyway`}
                    style={styles.overrideBtn}
                  >
                    <Text style={styles.overrideBtnText}>Add anyway</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onPress={() => onCommit('both')}
            accessibilityLabel="Save for Morning & Evening"
          >
            Save for Morning & Evening
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onPress={() => onCommit('am')}
            accessibilityLabel="Save for Morning Only"
          >
            Save for Morning Only
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onPress={() => onCommit('pm')}
            accessibilityLabel="Save for Evening Only"
          >
            Save for Evening Only
          </Button>
          <Button
            variant="ghost"
            size="md"
            fullWidth
            onPress={onClose}
            accessibilityLabel="Cancel and discard draft"
          >
            Cancel / Discard Draft
          </Button>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── Before → After block ─────────────────────────────────────────────────────

function PeriodDiff({
  label,
  before,
  afterSteps,
  nameOf,
  alternativesByWinner,
  onSwapAlternative,
}: {
  label: string;
  before: string[];
  afterSteps: PlannedStep[];
  nameOf: (productId: string | null) => string;
  alternativesByWinner: Map<string, SlotAlternative['alternatives']>;
  onSwapAlternative?: (winnerProductId: string, chosenProductId: string) => void;
}) {
  return (
    <View style={styles.periodBlock}>
      <Text style={styles.periodLabel}>{label}</Text>
      <View style={styles.diffColumns}>
        <View style={styles.diffColumn}>
          <Text style={styles.columnLabel}>Before</Text>
          {before.length > 0 ? (
            before.map((name, i) => (
              <Text key={`${name}-${i}`} style={styles.diffItemMuted} numberOfLines={1}>
                {name}
              </Text>
            ))
          ) : (
            <Text style={styles.diffItemMuted}>—</Text>
          )}
        </View>
        <Feather name="arrow-right" size={16} color={colors.textTertiary} style={styles.diffArrow} />
        <View style={styles.diffColumn}>
          <Text style={styles.columnLabel}>After</Text>
          {afterSteps.length > 0 ? (
            afterSteps.map((step) => (
              <View key={step.productId}>
                <Text style={styles.diffItem} numberOfLines={1}>
                  {nameOf(step.productId)}
                </Text>
                {(alternativesByWinner.get(step.productId) ?? []).map((alt) => (
                  <SlotAlternativeRow
                    key={alt.productId}
                    winnerProductName={nameOf(step.productId)}
                    alternativeProductName={nameOf(alt.productId)}
                    onSwap={() => onSwapAlternative?.(step.productId, alt.productId)}
                  />
                ))}
              </View>
            ))
          ) : (
            <Text style={styles.diffItemMuted}>—</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.bgBase,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handleIndicator: {
    backgroundColor: colors.borderStrong,
  },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[2],
    gap: space[4],
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  summary: {
    backgroundColor: colors.statusSafeTint,
    borderRadius: radius.md,
    padding: space[3],
    gap: space[1],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  summaryText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  periodBlock: {
    gap: space[2],
  },
  periodLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  diffColumns: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'flex-start',
  },
  diffColumn: {
    flex: 1,
    gap: space[1],
  },
  diffArrow: {
    marginTop: space[5],
  },
  columnLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  diffItem: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  diffItemMuted: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  pausedBlock: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: space[3],
    gap: space[1],
  },
  pausedText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  reserveHeading: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: space[1],
  },
  reserveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: space[1],
  },
  reserveTextWrap: {
    flex: 1,
    gap: 2,
  },
  reserveName: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  overrideBtn: {
    paddingHorizontal: space[3],
    paddingVertical: space[2] - 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  overrideBtnText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  actions: {
    gap: space[2],
    marginTop: space[2],
  },
});
