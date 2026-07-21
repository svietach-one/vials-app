import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/feedback/Badge';
import { Button } from '@/components/ui/core/Button';
import { Tag } from '@/components/ui/core/Tag';
import { Select, type SelectOption, type SelectOptionTone } from '@/components/ui/forms/Select';
import { reasonText } from '@/constants/decisionReasons';
import { colors, radius, shadow, space, typography } from '@/constants/tokens';
import type { PlanCommitScope } from '@/domain/routinePlanActions';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import type { RoutinePlan } from '@/utils/routineEngine/generate';
import { buildDraftSummaryLines } from '@/utils/routineEngine/planApply';
import type { PlannedStep, SlotAlternative } from '@/utils/routineEngine/planTypes';
import { getSlotIndex } from '@/utils/routineEngine/slotting';
import type { PlanDiffEntry } from '@/utils/routineEngine/validate';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftPreviewSheetProps {
  visible: boolean;
  onClose: () => void;
  plan: RoutinePlan | null;
  diff: PlanDiffEntry[];
  onCommit: (scope: PlanCommitScope) => void;
  /**
   * Story 2 (routine-similar-product-priority): fired when the user picks a
   * candidate from a step's "Replace with" select. `winnerProductId` is
   * always the recorded slot's stable identity key (never the currently-
   * admitted product — see planApply.ts), so repeated reselection keeps
   * working. The sheet never applies the swap itself — RoutinesScreen owns
   * rewriting the still-uncommitted draft via `applySlotAlternativeSwap`
   * (tech design §1). Optional so pre-existing callers/tests that predate
   * this feature keep typechecking.
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
 * Draft Preview (Diff Mode, research §3): each step renders as a vertical
 * changed/unchanged stack (screen-improvements redesign — no more clipped
 * side-by-side Before|After columns), with at most three quiet summary lines
 * and the four-way commit scope. Nothing here writes — the commit callback
 * routes through routinePlanActions.
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
  const [reserveExpanded, setReserveExpanded] = useState(false);

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

  // The currently-saved product occupying each layering slot, keyed by
  // slotIndex — used to decide whether an After step is "changing" and, if
  // so, what to show struck through above it. Saved RoutineStep has no
  // slotIndex of its own, so it's derived the same way validate.ts does.
  const oldStepsFor = (timeOfDay: 'morning' | 'evening'): Map<number, { productId: string }> => {
    const map = new Map<number, { productId: string }>();
    for (const routine of routines) {
      if (routine.timeOfDay !== timeOfDay) continue;
      for (const step of routine.steps) {
        if (step.hidden || !step.productId) continue;
        map.set(getSlotIndex(step.productType), { productId: step.productId });
      }
    }
    return map;
  };

  // Story 2 (routine-similar-product-priority): same-slot candidates, keyed
  // by slotIndex (stable regardless of which candidate is currently
  // admitted) so the "Replace with" select can always find its slot, even
  // after the user has already swapped once.
  const alternativesFor = (period: 'morning' | 'evening'): Map<number, SlotAlternative> =>
    new Map(
      (plan.slotAlternatives ?? []).filter((a) => a.period === period).map((a) => [a.slotIndex, a]),
    );

  const reasonForProduct = (productId: string): string | null => {
    const entry = plan.decisions.find((d) => d.productId === productId && d.reasonCode);
    return entry?.reasonCode ? reasonText(entry.reasonCode) : null;
  };

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

        <PeriodSteps
          label="Morning"
          afterSteps={plan.periods.morning}
          oldSteps={oldStepsFor('morning')}
          alternativesBySlot={alternativesFor('morning')}
          nameOf={nameOf}
          reasonForProduct={reasonForProduct}
          onSwapAlternative={onSwapAlternative}
        />
        <PeriodSteps
          label="Evening"
          afterSteps={plan.periods.evening}
          oldSteps={oldStepsFor('evening')}
          alternativesBySlot={alternativesFor('evening')}
          nameOf={nameOf}
          reasonForProduct={reasonForProduct}
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
            <Pressable
              onPress={() => setReserveExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: reserveExpanded }}
              accessibilityLabel={`In reserve, ${plan.reserve.length} product${plan.reserve.length === 1 ? '' : 's'}`}
              style={styles.reserveHeader}
            >
              <Text style={styles.reserveHeading}>
                {`In reserve · ${plan.reserve.length} product${plan.reserve.length === 1 ? '' : 's'}`}
              </Text>
              <Feather
                name={reserveExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textTertiary}
              />
            </Pressable>

            {reserveExpanded
              ? plan.reserve.map((item) => (
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
                ))
              : null}
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

// ─── Period block ─────────────────────────────────────────────────────────────

function PeriodSteps({
  label,
  afterSteps,
  oldSteps,
  alternativesBySlot,
  nameOf,
  reasonForProduct,
  onSwapAlternative,
}: {
  label: string;
  afterSteps: PlannedStep[];
  oldSteps: Map<number, { productId: string }>;
  alternativesBySlot: Map<number, SlotAlternative>;
  nameOf: (productId: string | null) => string;
  reasonForProduct: (productId: string) => string | null;
  onSwapAlternative?: (winnerProductId: string, chosenProductId: string) => void;
}) {
  return (
    <View style={styles.periodBlock}>
      <Text style={styles.periodLabel}>{label}</Text>
      {afterSteps.length > 0 ? (
        afterSteps.map((step) => (
          <RoutineStepRow
            key={step.productId}
            step={step}
            oldStep={oldSteps.get(step.slotIndex)}
            reason={reasonForProduct(step.productId)}
            entry={alternativesBySlot.get(step.slotIndex)}
            nameOf={nameOf}
            onSwapAlternative={onSwapAlternative}
          />
        ))
      ) : (
        <Text style={styles.diffItemMuted}>—</Text>
      )}
    </View>
  );
}

// ─── One step: changed/unchanged stack + "Replace with" select ────────────────

function RoutineStepRow({
  step,
  oldStep,
  reason,
  entry,
  nameOf,
  onSwapAlternative,
}: {
  step: PlannedStep;
  oldStep: { productId: string } | undefined;
  reason: string | null;
  entry: SlotAlternative | undefined;
  nameOf: (productId: string | null) => string;
  onSwapAlternative?: (winnerProductId: string, chosenProductId: string) => void;
}) {
  const isChanged = !oldStep || oldStep.productId !== step.productId;

  return (
    <View style={styles.stepCard}>
      {isChanged && oldStep ? (
        <>
          <Text style={styles.oldName}>{nameOf(oldStep.productId)}</Text>
          <Feather name="arrow-down" size={14} color={colors.textTertiary} style={styles.changeArrow} />
        </>
      ) : null}

      <Text style={isChanged ? styles.newNameChanged : styles.newName}>{nameOf(step.productId)}</Text>

      {isChanged ? (
        reason ? (
          <Badge status="Cobalt" type="Light" style={styles.reasonBadge}>
            {reason}
          </Badge>
        ) : null
      ) : (
        <Tag tone="neutral" style={styles.noChangeTag}>
          No change
        </Tag>
      )}

      {entry ? (
        <Select
          label="Replace with"
          value={step.productId}
          options={buildStepOptions(entry, step.productId, oldStep, nameOf)}
          onValueChange={(chosen) => onSwapAlternative?.(entry.winnerProductId, chosen)}
          accessibilityLabel={`Replace ${nameOf(step.productId)}`}
        />
      ) : null}
    </View>
  );
}

/**
 * Every candidate for one slot, deduplicated: the currently-admitted product
 * first, then the entry's original recommendation (if not already admitted),
 * then the pre-regeneration product as "keep current" when it's still a
 * recorded candidate, then the rest as "from reserve" — ranked best-first per
 * `resolvePeriods`.
 */
function buildStepOptions(
  entry: SlotAlternative,
  currentProductId: string,
  oldStep: { productId: string } | undefined,
  nameOf: (productId: string | null) => string,
): SelectOption[] {
  const options: SelectOption[] = [];
  const seen = new Set<string>();

  const push = (productId: string, reasonFragment: string, tone: SelectOptionTone) => {
    if (seen.has(productId)) return;
    seen.add(productId);
    options.push({ value: productId, title: nameOf(productId), reason: reasonFragment, tone });
  };

  push(
    currentProductId,
    currentProductId === entry.winnerProductId
      ? 'recommended'
      : oldStep?.productId === currentProductId
      ? 'keep current'
      : 'from reserve',
    currentProductId === entry.winnerProductId
      ? 'recommended'
      : oldStep?.productId === currentProductId
      ? 'neutral'
      : 'info',
  );

  push(entry.winnerProductId, 'recommended', 'recommended');

  if (oldStep && entry.alternatives.some((alt) => alt.productId === oldStep.productId)) {
    push(oldStep.productId, 'keep current', 'neutral');
  }

  for (const alt of entry.alternatives) {
    push(alt.productId, 'from reserve', 'info');
  }

  return options;
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
    gap: space[3],
  },
  periodLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  diffItemMuted: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },

  stepCard: {
    gap: space[1],
    padding: space[3],
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    ...shadow.sm,
  },
  oldName: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  changeArrow: {
    marginVertical: 1,
  },
  newName: {
    ...typography.body,
    color: colors.textPrimary,
  },
  newNameChanged: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  reasonBadge: {
    marginTop: space[1],
  },
  noChangeTag: {
    marginTop: space[1],
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
  reserveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reserveHeading: {
    ...typography.label,
    color: colors.textPrimary,
  },
  reserveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: space[1],
    marginTop: space[2],
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
