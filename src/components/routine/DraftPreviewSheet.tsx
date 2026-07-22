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
import { ProductThumbnail } from '@/components/ui/ProductThumbnail';
import { Tag } from '@/components/ui/core/Tag';
import {
  selectToneColor,
  type SelectOption,
  type SelectOptionTone,
} from '@/components/ui/forms/Select';
import { reasonText } from '@/constants/decisionReasons';
import { PRODUCT_TYPE_LABELS } from '@/constants/labels';
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
 * Draft Preview (Diff Mode, research §3): Morning then Evening, each period a
 * numbered list of steps in the order they are applied (layering order, not
 * score order). Every step is one card — number + slot category on the left,
 * product identity on the right — and a card with recorded same-slot
 * candidates is a dropdown: tapping it expands the replacements inline
 * instead of opening a separate Select modal.
 *
 * Nothing here writes — commits route through routinePlanActions and swaps
 * bubble up to RoutinesScreen, which owns the uncommitted draft.
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
          period="morning"
          afterSteps={plan.periods.morning}
          oldSteps={oldStepsFor('morning')}
          alternativesBySlot={alternativesFor('morning')}
          nameOf={nameOf}
          productOf={productOf}
          reasonForProduct={reasonForProduct}
          onSwapAlternative={onSwapAlternative}
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
  onSwapAlternative,
}: {
  label: string;
  period: 'morning' | 'evening';
  afterSteps: PlannedStep[];
  oldSteps: Map<number, { productId: string }>;
  alternativesBySlot: Map<number, SlotAlternative>;
  nameOf: (productId: string | null) => string;
  productOf: (productId: string | null) => Product | undefined;
  reasonForProduct: (productId: string) => string | null;
  onSwapAlternative?: (winnerProductId: string, chosenProductId: string) => void;
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
          <Feather
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
            onSwapAlternative={onSwapAlternative}
          />
        ))
      ) : (
        <Text style={styles.diffItemMuted}>—</Text>
      )}
    </View>
  );
}

// ─── One step: numbered identity card that expands into its replacements ──────

function StepCard({
  position,
  step,
  oldStep,
  reason,
  entry,
  nameOf,
  productOf,
  onSwapAlternative,
}: {
  position: number;
  step: PlannedStep;
  oldStep: { productId: string } | undefined;
  reason: string | null;
  entry: SlotAlternative | undefined;
  nameOf: (productId: string | null) => string;
  productOf: (productId: string | null) => Product | undefined;
  onSwapAlternative?: (winnerProductId: string, chosenProductId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isChanged = !oldStep || oldStep.productId !== step.productId;
  const product = productOf(step.productId);
  const name = nameOf(step.productId);
  const typeLabel = PRODUCT_TYPE_LABELS[step.productType] ?? step.productType;
  // Only a slot with recorded candidates is a dropdown; the rest are plain
  // cards, so a chevron always means "there is something to choose here".
  const isExpandable = !!entry;

  return (
    <View style={styles.stepCard}>
      <Pressable
        style={styles.stepHeader}
        onPress={isExpandable ? () => setExpanded((v) => !v) : undefined}
        disabled={!isExpandable}
        accessibilityRole={isExpandable ? 'button' : undefined}
        accessibilityState={isExpandable ? { expanded } : undefined}
        accessibilityLabel={isExpandable ? `Replace ${name}` : name}
      >
        <View style={styles.positionColumn}>
          <Text style={styles.positionNumber}>{position}</Text>
          <Text style={styles.positionLabel} numberOfLines={1}>
            {typeLabel}
          </Text>
        </View>

        {product ? <ProductThumbnail product={product} size={56} /> : null}

        <View style={styles.identity}>
          {product?.brand ? (
            <Text style={styles.brand} numberOfLines={1}>
              {product.brand}
            </Text>
          ) : null}
          <Text style={isChanged ? styles.nameChanged : styles.name} numberOfLines={2}>
            {name}
          </Text>

          {isChanged && oldStep ? (
            <Text style={styles.oldName} numberOfLines={1}>
              {nameOf(oldStep.productId)}
            </Text>
          ) : null}
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
        </View>

        {isExpandable ? (
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textTertiary}
          />
        ) : null}
      </Pressable>

      {isExpandable && expanded && entry ? (
        <View style={styles.dropdown}>
          <Text style={styles.dropdownLabel}>Replace with</Text>
          {buildStepOptions(entry, step.productId, oldStep, nameOf).map((option) => (
            <ReplacementRow
              key={option.value}
              option={option}
              product={productOf(option.value)}
              selected={option.value === step.productId}
              onPress={() => {
                setExpanded(false);
                onSwapAlternative?.(entry.winnerProductId, option.value);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** One candidate inside an expanded step card. */
function ReplacementRow({
  option,
  product,
  selected,
  onPress,
}: {
  option: SelectOption;
  product: Product | undefined;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.optionRow, selected && styles.optionRowSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={option.reason ? `${option.title} — ${option.reason}` : option.title}
    >
      {product ? <ProductThumbnail product={product} size={40} /> : null}
      <View style={styles.optionText}>
        <Text style={styles.optionTitle} numberOfLines={2}>
          {option.title}
        </Text>
        {option.reason ? (
          <Text
            style={[styles.optionReason, { color: toneColorOf(option.tone) }]}
            numberOfLines={1}
          >
            {option.reason}
          </Text>
        ) : null}
      </View>
      {selected ? <Feather name="check" size={18} color={colors.textPrimary} /> : null}
    </Pressable>
  );
}

const toneColorOf = (tone: SelectOptionTone | undefined) => selectToneColor[tone ?? 'neutral'];

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
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
  },
  // Fixed width so every card's product identity starts at the same x, however
  // long the category label is.
  positionColumn: {
    width: 60,
    alignItems: 'center',
    gap: 2,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.borderDivider,
    paddingRight: space[2],
  },
  positionNumber: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  positionLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  brand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  name: {
    ...typography.body,
    color: colors.textPrimary,
  },
  nameChanged: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  oldName: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  reasonBadge: {
    marginTop: space[1],
    alignSelf: 'flex-start',
  },
  noChangeTag: {
    marginTop: space[1],
    alignSelf: 'flex-start',
  },

  dropdown: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderDivider,
    paddingHorizontal: space[3],
    paddingTop: space[2],
    paddingBottom: space[2],
    gap: space[1],
  },
  dropdownLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
    paddingHorizontal: space[2],
    borderRadius: radius.sm,
  },
  optionRowSelected: {
    backgroundColor: colors.surfaceSunken,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionTitle: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  optionReason: {
    ...typography.caption,
    fontSize: 12,
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
