import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { Icon } from '@/components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/ui/core/AppHeader';
import { Badge } from '@/components/ui/feedback/Badge';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { ProductThumbnail } from '@/components/ui/ProductThumbnail';
import { Tag } from '@/components/ui/core/Tag';
import { ReplaceStepSheet, type ReplaceStepTarget } from '@/components/routine/ReplaceStepSheet';
import { type SelectOption, type SelectOptionTone } from '@/components/ui/forms/Select';
import { reasonText } from '@/constants/decisionReasons';
import { getSlotCategoryLabel, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
import type { PlanCommitScope } from '@/domain/routinePlanActions';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import type { Product } from '@/types';
import type { RoutinePlan } from '@/utils/routineEngine/generate';
import { buildDraftSummaryLines } from '@/utils/routineEngine/planApply';
import type { PlannedStep, SlotAlternative } from '@/utils/routineEngine/planTypes';
import { getSlotIndex, orderSteps } from '@/utils/routineEngine/slotting';
import type { PlanDiffEntry } from '@/utils/routineEngine/validate';
import { formatScheduleDays } from '@/utils/routineLabel';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftPreviewScreenProps {
  visible: boolean;
  onClose: () => void;
  plan: RoutinePlan | null;
  diff: PlanDiffEntry[];
  onCommit: (scope: PlanCommitScope) => void;
  /**
   * Story 2 (routine-similar-product-priority): fired when the user picks a
   * candidate from a step's replacement sheet. `winnerProductId` is always the
   * recorded slot's stable identity key (never the currently-admitted product
   * — see planApply.ts), so repeated reselection keeps working. The screen
   * never applies the swap itself — RoutinesScreen owns rewriting the still-
   * uncommitted draft via `applySlotAlternativeSwap` (tech design §1). Optional
   * so pre-existing callers/tests that predate this feature keep typechecking.
   */
  onSwapAlternative?: (winnerProductId: string, chosenProductId: string) => void;
  /**
   * Fired when the user taps "Add anyway" on a reserved product (phase-07
   * override). The screen never applies it — RoutinesScreen records the
   * override and regenerates the draft. Optional so older callers keep
   * typechecking.
   */
  onOverride?: (productId: string) => void;
}

const SNAP_POINTS = ['100%'];
const HIDE_HANDLE = () => null;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Routine Draft (Diff Mode, research §3), presented as a full screen with a
 * back arrow rather than a bottom sheet: Morning then Evening, each period a
 * numbered list of steps in the order they are applied (layering order, not
 * score order). Every step is one card — number + slot category on the left,
 * product identity on the right — and a step with recorded same-slot
 * candidates carries a "Change" affordance that opens the ReplaceStepSheet
 * (screen-2) for that slot.
 *
 * Nothing here writes — commits route through routinePlanActions and swaps
 * bubble up to RoutinesScreen, which owns the uncommitted draft.
 */
export function DraftPreviewScreen({
  visible,
  onClose,
  plan,
  diff,
  onCommit,
  onSwapAlternative,
  onOverride,
}: DraftPreviewScreenProps) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const wasPresented = useRef(false);
  const [reserveExpanded, setReserveExpanded] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<ReplaceStepTarget | null>(null);

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

  // A closed screen must never leave a stale replacement sheet queued.
  useEffect(() => {
    if (!visible) setReplaceTarget(null);
  }, [visible]);

  if (!plan) return null;

  const productOf = (productId: string | null): Product | undefined =>
    (productId && products.find((p) => p.id === productId)) || undefined;
  const nameOf = (productId: string | null) => productOf(productId)?.name ?? 'Unknown product';
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
  // admitted) so the replacement sheet can always find its slot, even after
  // the user has already swapped once.
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

  const handleSelectReplacement = (chosenProductId: string) => {
    if (replaceTarget) onSwapAlternative?.(replaceTarget.winnerProductId, chosenProductId);
    setReplaceTarget(null);
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      topInset={0}
      handleComponent={HIDE_HANDLE}
      enablePanDownToClose={false}
      enableDynamicSizing={false}
      onDismiss={onClose}
      backgroundStyle={styles.screenBackground}
    >
      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <AppHeader
          title="Routine Draft"
          leftAction={
            <IconButton
              icon={<Icon name="arrow-left" size={18} color={colors.textPrimary} />}
              label="Back"
              variant="ghost"
              size="sm"
              onPress={onClose}
            />
          }
        />
      </View>

      <BottomSheetScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[6] }]}
        showsVerticalScrollIndicator={false}
      >
        {summaryLines.length > 0 ? (
          <View style={styles.summary}>
            {summaryLines.map((line) => (
              <View key={line} style={styles.summaryRow}>
                <Icon name="check" size={14} color={colors.statusSafe} />
                <Text style={styles.summaryText}>{line}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <PeriodSteps
          label="Morning"
          period="morning"
          afterSteps={plan.periods.morning}
          oldSteps={oldStepsFor('morning')}
          alternativesBySlot={alternativesFor('morning')}
          nameOf={nameOf}
          productOf={productOf}
          reasonForProduct={reasonForProduct}
          onRequestReplace={setReplaceTarget}
        />
        <PeriodSteps
          label="Evening"
          period="evening"
          afterSteps={plan.periods.evening}
          oldSteps={oldStepsFor('evening')}
          alternativesBySlot={alternativesFor('evening')}
          nameOf={nameOf}
          productOf={productOf}
          reasonForProduct={reasonForProduct}
          onRequestReplace={setReplaceTarget}
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
              <Icon
                name={reserveExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textTertiary}
              />
            </Pressable>

            <Text style={styles.reserveIntro}>{reserveIntroText(plan.reserve)}</Text>

            {reserveExpanded
              ? plan.reserve.map((item) => (
                  <View key={item.productId} style={styles.reserveRow}>
                    <View style={styles.reserveTextWrap}>
                      <Text style={styles.reserveName}>{nameOf(item.productId)}</Text>
                      {/* Only a reason the shared intro does NOT already state:
                          "kept in reserve because your goals don't call for it"
                          is said once above, but "another product already covers
                          this role" is specific to the row and must survive. */}
                      {item.reasonCode === 'not_needed_for_goals' ? null : (
                        <Text style={styles.pausedText}>{reasonText(item.reasonCode)}</Text>
                      )}
                    </View>
                    {onOverride ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onPress={() => onOverride(item.productId)}
                        accessibilityLabel={`Add ${nameOf(item.productId)} anyway`}
                      >
                        Add anyway
                      </Button>
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

      <ReplaceStepSheet
        target={replaceTarget}
        onClose={() => setReplaceTarget(null)}
        productOf={productOf}
        onSelect={handleSelectReplacement}
      />
    </BottomSheetModal>
  );
}

/**
 * One shared explanation for the whole reserve list, so the identical
 * "your goals don't call for this product" sentence isn't repeated on every
 * row. The goals clause is only claimed when at least one product actually
 * landed in reserve for that reason — otherwise (all capped, all duplicates)
 * the line states just the choice the user has.
 */
function reserveIntroText(reserve: RoutinePlan['reserve']): string {
  const action = 'Keep them in reserve, or add any of them to your routine anyway.';
  const forGoals = reserve.some((item) => item.reasonCode === 'not_needed_for_goals');
  return forGoals ? `Your current goals don’t call for these products. ${action}` : action;
}

// ─── Period block ─────────────────────────────────────────────────────────────

function PeriodSteps({
  label,
  period,
  afterSteps,
  oldSteps,
  alternativesBySlot,
  nameOf,
  productOf,
  reasonForProduct,
  onRequestReplace,
}: {
  label: string;
  period: 'morning' | 'evening';
  afterSteps: PlannedStep[];
  oldSteps: Map<number, { productId: string }>;
  alternativesBySlot: Map<number, SlotAlternative>;
  nameOf: (productId: string | null) => string;
  productOf: (productId: string | null) => Product | undefined;
  reasonForProduct: (productId: string) => string | null;
  onRequestReplace: (target: ReplaceStepTarget) => void;
}) {
  const isMorning = period === 'morning';
  // Application order, not score order: the list reads top-to-bottom exactly
  // as the routine is performed. Re-sorted here rather than trusted from the
  // plan, since a swap rewrites the draft after the engine ordered it.
  const ordered = orderSteps(afterSteps);

  return (
    <View style={styles.periodBlock}>
      <View style={styles.periodHeader}>
        <View
          style={[
            styles.periodIconCircle,
            { backgroundColor: isMorning ? palette.marigoldTint : palette.cobaltTint },
          ]}
        >
          <Icon
            name={isMorning ? 'sun' : 'moon'}
            size={14}
            color={isMorning ? palette.marigold : palette.cobalt}
          />
        </View>
        <Text style={styles.periodLabel}>{label}</Text>
      </View>

      {ordered.length > 0 ? (
        ordered.map((step, i) => (
          <StepCard
            key={step.productId}
            position={i + 1}
            step={step}
            oldStep={oldSteps.get(step.slotIndex)}
            reason={reasonForProduct(step.productId)}
            entry={alternativesBySlot.get(step.slotIndex)}
            nameOf={nameOf}
            productOf={productOf}
            onRequestReplace={onRequestReplace}
          />
        ))
      ) : (
        <Text style={styles.diffItemMuted}>—</Text>
      )}
    </View>
  );
}

// ─── One step: numbered identity card with a "Change" affordance ──────────────

function StepCard({
  position,
  step,
  oldStep,
  reason,
  entry,
  nameOf,
  productOf,
  onRequestReplace,
}: {
  position: number;
  step: PlannedStep;
  oldStep: { productId: string } | undefined;
  reason: string | null;
  entry: SlotAlternative | undefined;
  nameOf: (productId: string | null) => string;
  productOf: (productId: string | null) => Product | undefined;
  onRequestReplace: (target: ReplaceStepTarget) => void;
}) {
  const isChanged = !oldStep || oldStep.productId !== step.productId;
  const product = productOf(step.productId);
  const name = nameOf(step.productId);
  const typeLabel = PRODUCT_TYPE_LABELS[step.productType] ?? step.productType;
  // Only a slot with recorded candidates offers a "Change" — the rest are
  // plain cards, so the affordance always means "there is something to choose".
  const isSwappable = !!entry;
  const showReasonBadge = isChanged && !!reason;
  // "No change" only means something when there's nothing to swap to — once
  // a Change action exists, showing it alongside renders the pill's "nothing
  // to do here" message contradictory, so Change wins.
  const showNoChangeTag = !isChanged && !isSwappable;
  const showStatusRow = showReasonBadge || showNoChangeTag || isSwappable;

  const openReplace = () => {
    if (!entry) return;
    onRequestReplace({
      winnerProductId: entry.winnerProductId,
      categoryLabel: getSlotCategoryLabel(step.productType),
      options: buildStepOptions(entry, step.productId, oldStep, nameOf),
      currentProductId: step.productId,
    });
  };

  return (
    <View style={styles.stepCard}>
      {/* Step number + slot category, flush with the card's left edge, above
          the photo — frequency marker pinned to the right of the same line. */}
      <View style={styles.titleLine}>
        <View style={styles.titleLineLeft}>
          <Text style={styles.stepNumber}>{position}.</Text>
          <Text style={styles.stepCategory} numberOfLines={1}>
            {typeLabel}
          </Text>
        </View>
        <Text style={styles.frequency} numberOfLines={1}>
          {formatScheduleDays(step.scheduledDays)}
        </Text>
      </View>

      <View style={styles.stepRow}>
        {product ? <ProductThumbnail product={product} size={76} /> : null}

        <View style={styles.identity}>
          <Text style={isChanged ? styles.nameChanged : styles.name} numberOfLines={2}>
            {name}
          </Text>
          {product?.brand ? (
            <Text style={styles.brand} numberOfLines={1}>
              {product.brand}
            </Text>
          ) : null}

          {isChanged && oldStep ? (
            <Text style={styles.oldName} numberOfLines={1}>
              {nameOf(oldStep.productId)}
            </Text>
          ) : null}

          {/* Row itself is conditional so a changed step with no reason and
              no alternative (nothing to show either side) doesn't leave a
              bare gap behind. */}
          {showStatusRow ? (
            <View style={styles.statusRow}>
              {showReasonBadge ? (
                <Badge status="Cobalt" type="Light">
                  {reason}
                </Badge>
              ) : showNoChangeTag ? (
                <Tag tone="neutral">No change</Tag>
              ) : null}

              {isSwappable ? (
                <Pressable
                  style={styles.changeButton}
                  onPress={openReplace}
                  accessibilityRole="button"
                  accessibilityLabel={`Change ${name}`}
                >
                  <Text style={styles.changeLabel}>Change</Text>
                  <Icon name="chevron-right" size={18} color={palette.plum} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
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
  screenBackground: {
    backgroundColor: colors.bgScreen,
    borderRadius: 0,
  },
  headerWrap: {
    backgroundColor: colors.bgBase,
  },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[4],
    gap: space[4],
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
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  // Same circle treatment as the Routines screen's period headers and My
  // Shelf's sun/moon badges.
  periodIconCircle: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    ...shadow.sm,
  },
  stepRow: {
    flexDirection: 'row',
    // Top edge lines up with the name line (identity's first row), not the
    // whole content block — the photo previously centered against brand/
    // frequency/reason rows too and drifted below the product name.
    alignItems: 'flex-start',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingBottom: space[3],
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: space[1],
  },
  // "1.  Cleanser" (left, flush above the photo) + frequency marker (right),
  // e.g. "2.  Cream                              Every day".
  titleLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingTop: space[3],
    paddingBottom: space[1],
  },
  titleLineLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[3],
    flexShrink: 1,
  },
  stepNumber: {
    ...typography.body,
    fontFamily: 'DMSans-Bold',
    color: colors.textPrimary,
  },
  stepCategory: {
    ...typography.body,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  brand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  frequency: {
    ...typography.caption,
    color: colors.textTertiary,
    flexShrink: 0,
  },
  name: {
    ...typography.body,
    fontFamily: 'DMSans-Bold',
    color: colors.textPrimary,
  },
  nameChanged: {
    ...typography.body,
    fontFamily: 'DMSans-Bold',
    color: colors.textPrimary,
  },
  oldName: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  // Status pill (left) + Change action (right), same row.
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[1],
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    // Pushes to the row's right edge whether or not a status pill precedes it.
    marginLeft: 'auto',
    gap: 2,
    paddingVertical: space[1],
    paddingLeft: space[2],
  },
  changeLabel: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.plum,
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
  reserveIntro: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: space[1],
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
  actions: {
    gap: space[2],
    marginTop: space[2],
  },
});
