import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import type { RenderItemParams } from 'react-native-draggable-flatlist';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';

import { AddToRoutineSheet } from '@/components/routine/AddToRoutineSheet';
import { ClinicalRestrictionsBlock } from '@/components/routine/ClinicalRestrictionsBlock';
import { DraftPreviewSheet } from '@/components/routine/DraftPreviewSheet';
import { DuplicateSlotResolutionSheet } from '@/components/routine/DuplicateSlotResolutionSheet';
import {
  DuplicateSlotWarningInline,
  type DuplicateSlotGroupPress,
} from '@/components/routine/DuplicateSlotWarningInline';
import { GenerateCard } from '@/components/routine/GenerateCard';
import { OptimizeStrip } from '@/components/routine/OptimizeStrip';
import { PreCleanseReminderCard } from '@/components/routine/PreCleanseReminderCard';
import { PlannerBlock, type RoutineViewMode } from '@/components/routine/PlannerBlock';
import { RehabWidget } from '@/components/routine/RehabWidget';
import { RoutineCalendarView } from '@/components/routine/RoutineCalendarView';
import { RemoveStepModal } from '@/components/routine/RemoveStepModal';
import { RoutineStepActionSheet } from '@/components/routine/RoutineStepActionSheet';
import { RoutineStepCard } from '@/components/routine/RoutineStepCard';
import { GoalConfirmBanner } from '@/components/routine/GoalConfirmBanner';
import { PhototypeConfirmBanner } from '@/components/routine/PhototypeConfirmBanner';
import { SeasonalNoticeBanner } from '@/components/routine/SeasonalNoticeBanner';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { getSlotCategoryLabel, GOAL_LABELS } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { RootTabParamList } from '@/navigation/AppNavigator';
import {
  applyRoutinePlan,
  currentOverrideHash,
  validateCurrentRoutines,
  type PlanCommitScope,
} from '@/domain/routinePlanActions';
import { getActiveSeasonMask } from '@/domain/seasonActions';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrackingStore } from '@/store/trackingStore';
import { ConflictEngine } from '@/utils/conflictEngine';
import { isScheduledOnDay } from '@/utils/routineSchedule';
import {
  buildRoutineRows,
  getInitialAccordionState,
  mergeReorderedSteps,
  resolveDragResult,
  routineRowKey,
  type AccordionState,
  type RoutineRow,
} from '@/utils/routineAccordion';
import { getAdaptationStatus } from '@/utils/routineEngine/adaptation';
import { buildRoutineContext } from '@/utils/routineEngine/context';
import { getDailyView, type FrozenStepView } from '@/utils/routineEngine/dailyView';
import { rankSlotGroup } from '@/utils/routineEngine/duplicateSlot';
import { applySlotAlternativeSwap } from '@/utils/routineEngine/planApply';
import { findPreCleanseReminder } from '@/utils/routineEngine/preCleanseReminder';
import { buildProductFacts, buildShelfFacts } from '@/utils/routineEngine/productFacts';
import { buildRehabWidgetState } from '@/utils/routineEngine/rehabFilter';
import type { ValidationResult } from '@/utils/routineEngine/validate';
import type { Product, RoutineStep } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = BottomTabScreenProps<RootTabParamList, 'Routines'>;
type Period = 'morning' | 'evening';

// ─── Period card colors (img-03 redesign) ──────────────────────────────────────
// Morning and evening each render as their own tinted "dropdown card" — a
// single hairline outline (not a blurred shadow) draws its boundary. Each
// period is faked from several adjacent, separately-rendered flat-list rows
// (header + steps) sharing one background color rather than one real nested
// View, since the drag-safety design requires a single flat list. A blurred
// shadow.sm was tried per-row first, but RN shadow blur radiates in every
// direction from a view's own edge, not just outward from its offset — so
// each row's shadow bled UPWARD onto the row painted immediately before it
// (later siblings paint on top), showing as a visible seam under every
// individual step card instead of one clean shadow around the whole group.
// A border has no such blur-bleed and needs no elevation-based z-order trick,
// so it's applied selectively per edge instead: top only on the header, left/
// right on every row, bottom only on the last row — producing one continuous
// outline with no seams.
const PERIOD_CARD_BORDER_COLOR = 'rgba(9, 9, 11, 0.08)';
const PERIOD_BG: Record<Period, string> = {
  morning: palette.citronTint,
  evening: palette.cobaltTint,
};
const PERIOD_ICON_COLOR: Record<Period, string> = {
  morning: palette.citron,
  evening: palette.cobalt,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isStepForDay(step: RoutineStep, dow: number): boolean {
  return isScheduledOnDay(step.scheduledDays, dow);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RoutinesScreen({ navigation }: Props) {
  const products = useProductsStore((s) => s.products);
  const routines = useRoutinesStore((s) => s.routines);
  const procedures = useProceduresStore((s) => s.procedures);
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const cycleType = useSettingsStore((s) => s.routineCycleType);
  const applicationStats = useTrackingStore((s) => s.applicationStats);
  const reorderSteps = useRoutinesStore((s) => s.reorderSteps);
  const removeStepFromDay = useRoutinesStore((s) => s.removeStepFromDay);
  const removeProductStep = useRoutinesStore((s) => s.removeProductStep);
  const setStepHidden = useRoutinesStore((s) => s.setStepHidden);

  const [viewMode, setViewMode] = useState<RoutineViewMode>('list');
  // Decided once, on mount: before 15:00 Morning is open, after it Evening is.
  // Manual toggles win from then on — never recomputed on re-render.
  const [expanded, setExpanded] = useState<AccordionState>(() => getInitialAccordionState());
  const [selectedDow, setSelectedDow] = useState<number>(() => new Date().getDay());
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const [sheetStep, setSheetStep] = useState<{ stepId: string; routineId: string } | null>(null);
  // Which period new-product flows default to, from the same 15:00 rule.
  const defaultPeriod: Period = expanded.morning ? 'morning' : 'evening';
  const [pendingRemoval, setPendingRemoval] = useState<{ stepId: string; productId: string; productName: string; routineId: string } | null>(null);
  // Draft Preview state — a generated plan lives only here until committed
  const [draft, setDraft] = useState<ValidationResult | null>(null);
  // Story 3 (routine-similar-product-priority): the duplicate-slot group
  // currently opened in the resolution sheet, if any.
  const [pendingDuplicateGroup, setPendingDuplicateGroup] = useState<DuplicateSlotGroupPress | null>(null);

  // Restore today's day when the screen gains focus.
  useFocusEffect(
    useCallback(() => {
      setSelectedDow(new Date().getDay());
    }, []),
  );

  const handleDaySelect = useCallback((dow: number) => {
    setSelectedDow(dow);
  }, []);

  const toggleSection = useCallback((period: Period) => {
    setExpanded((prev) => ({ ...prev, [period]: !prev[period] }));
  }, []);

  // Single shared entry point for both the header "+" and the in-content
  // "Add product" button — both must open the exact same flow.
  const handleOpenAddSheet = useCallback(() => {
    setAddSheetVisible(true);
  }, []);

  const morningRoutine = routines.find((r) => r.timeOfDay === 'morning');
  const eveningRoutine = routines.find((r) => r.timeOfDay === 'evening');
  const totalSteps =
    (morningRoutine?.steps.length ?? 0) + (eveningRoutine?.steps.length ?? 0);

  // Validate mode over the saved routines — avoid-level findings light the
  // bottom Optimize strip (research §3; never a banner, never a modal).
  const validation = useMemo(
    () => (totalSteps > 0 ? validateCurrentRoutines() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads stores via getState; these deps cover every input
    [routines, products, procedures, totalSteps],
  );

  const handleOpenDraftPreview = useCallback(() => {
    setDraft(validateCurrentRoutines());
  }, []);

  const handleCommitDraft = useCallback(
    (scope: PlanCommitScope) => {
      if (draft) applyRoutinePlan(draft.proposedPlan, scope);
      // Post-commit revalidation happens via the validation memo on the next
      // render — a scope-induced conflict lights the strip, never a modal.
      setDraft(null);
    },
    [draft],
  );

  // Story 2 (routine-similar-product-priority): one-tap swap over the
  // still-uncommitted draft — a pure array splice, no re-run of eligibility/
  // frequency-cap math (planApply.ts). Never touches the saved routines.
  const handleSwapAlternative = useCallback((winnerProductId: string, chosenProductId: string) => {
    setDraft((prev) =>
      prev
        ? { ...prev, proposedPlan: applySlotAlternativeSwap(prev.proposedPlan, winnerProductId, chosenProductId) }
        : prev,
    );
  }, []);

  // phase-07 override: record the "add anyway" and regenerate the draft so the
  // forced-in product now appears in the plan.
  const handleOverride = useCallback((productId: string) => {
    useTrackingStore.getState().addOverride(productId, currentOverrideHash());
    setDraft(validateCurrentRoutines());
  }, []);

  // Story 3 (routine-similar-product-priority): tapping a duplicate-slot
  // banner row ranks that group (best/recommended first) and opens the
  // resolution sheet with it.
  const handlePressDuplicateGroup = useCallback((group: DuplicateSlotGroupPress) => {
    setPendingDuplicateGroup(group);
  }, []);

  const duplicateResolution = useMemo(() => {
    if (!pendingDuplicateGroup) return null;
    const routine = routines.find((r) => r.id === pendingDuplicateGroup.routineId);
    if (!routine) return null;
    const idSet = new Set(pendingDuplicateGroup.productIds);
    const group = routine.steps.filter((s) => s.productId && idSet.has(s.productId));
    if (group.length === 0) return null;

    const facts = buildShelfFacts(products);
    const context = buildRoutineContext({
      procedures,
      profile: { fitzpatrick: profile?.fitzpatrick ?? null },
      seasonMask: getActiveSeasonMask(),
    });
    const period = routine.timeOfDay === 'morning' ? 'am' : 'pm';
    const rankedProducts = rankSlotGroup(group, products, facts, context, profile?.concerns ?? [], period);

    return {
      routineId: routine.id,
      slotLabel: getSlotCategoryLabel(group[0].productType),
      rankedProducts,
    };
  }, [pendingDuplicateGroup, routines, products, procedures, profile]);

  // Adaptation weeks per product (⏳ status line, research §2.6) + clinical
  // "Paused until" rows from the daily-mask projection.
  const { adaptationWeeks, frozenRows, rehabState } = useMemo(() => {
    const weeks = new Map<string, number>();
    for (const product of products) {
      const status = getAdaptationStatus(
        product,
        buildProductFacts(product),
        applicationStats,
        cycleType,
      );
      if (status?.week != null) weeks.set(product.id, status.week);
    }

    const views = getDailyView(routines, products, {
      procedures,
      profile: { fitzpatrick: profile?.fitzpatrick ?? null },
      seasonMask: getActiveSeasonMask(),
    });
    const frozen = new Map<string, FrozenStepView[]>();
    for (const view of views) frozen.set(view.routineId, view.frozen);

    return {
      adaptationWeeks: weeks,
      frozenRows: frozen,
      rehabState: buildRehabWidgetState(procedures),
    };
  }, [products, routines, procedures, profile, cycleType, applicationStats]);

  const { amSteps, pmSteps, conflictMap } = useMemo(() => {
    // Clinically frozen steps leave the visible list (research §1.5: the
    // RehabWidget + Paused rows explain them — never silent, never draggable)
    const frozenStepIds = new Set(
      [...frozenRows.values()].flat().map((f) => f.stepId),
    );
    const isVisible = (s: RoutineStep) =>
      !s.hidden &&
      !frozenStepIds.has(s.id) &&
      isStepForDay(s, selectedDow) &&
      !(s.productId && products.find((p) => p.id === s.productId)?.isHidden);

    const am = (morningRoutine?.steps ?? []).filter(isVisible);
    const pm = (eveningRoutine?.steps ?? []).filter(isVisible);
    const allSteps = [...am, ...pm];

    const conflicts = ConflictEngine.detectConflicts(allSteps, products);
    const map = new Map<string, string>();
    for (const c of conflicts) {
      const stepA = allSteps.find((s) => s.id === c.stepIdA);
      const stepB = allSteps.find((s) => s.id === c.stepIdB);
      const productA = stepA?.productId ? products.find((p) => p.id === stepA.productId) : null;
      const productB = stepB?.productId ? products.find((p) => p.id === stepB.productId) : null;
      if (productA && productB) {
        if (!map.has(c.stepIdA)) map.set(c.stepIdA, productB.name);
        if (!map.has(c.stepIdB)) map.set(c.stepIdB, productA.name);
      }
    }

    return { amSteps: am, pmSteps: pm, conflictMap: map };
  }, [routines, products, selectedDow, frozenRows]);

  // Both periods render together; rows are one flat list so long-press drag
  // never competes with an outer scroll container (see routineAccordion).
  const rows = useMemo(
    () => buildRoutineRows(amSteps, pmSteps, expanded),
    [amSteps, pmSteps, expanded],
  );

  // Computed once here (not inside PreCleanseReminderCard) so renderItem can
  // match reminder.stepId against each step it renders and place the card
  // directly under that specific step's own row.
  const preCleanseReminder = useMemo(
    () => findPreCleanseReminder(routines, products),
    [routines, products],
  );

  function handleDragEnd(reorderedRows: RoutineRow[]) {
    const resolved = resolveDragResult(reorderedRows);
    // Cross-section drop (AM↔PM) — out of scope, so keep the previous order.
    if (!resolved) return;

    const commit = (routine: typeof morningRoutine, visible: RoutineStep[]) => {
      if (!routine) return;
      const merged = mergeReorderedSteps(routine.steps, visible);
      if (merged) reorderSteps(routine.id, merged);
    };

    commit(morningRoutine, resolved.morning);
    commit(eveningRoutine, resolved.evening);
  }

  function openStepSheet(product: Product, stepId: string, period: Period) {
    const routine = period === 'morning' ? morningRoutine : eveningRoutine;
    if (!routine) return;
    setSheetProduct(product);
    setSheetStep({ stepId, routineId: routine.id });
  }

  function closeStepSheet() {
    setSheetProduct(null);
    setSheetStep(null);
  }

  /**
   * Calendar rows identify a product, not a step. Resolve it to its first
   * visible step (morning before evening) so the sheet's remove/hide actions
   * have something concrete to act on.
   */
  function openStepSheetForProduct(product: Product) {
    for (const routine of [morningRoutine, eveningRoutine]) {
      const step = routine?.steps.find((s) => s.productId === product.id && !s.hidden);
      if (routine && step) {
        setSheetProduct(product);
        setSheetStep({ stepId: step.id, routineId: routine.id });
        return;
      }
    }
  }

  const renderItem = useCallback(
    ({ item, getIndex, drag, isActive: _isActive }: RenderItemParams<RoutineRow>) => {
      if (item.kind === 'section') {
        return (
          <SectionHeader
            period={item.period}
            count={item.count}
            expanded={item.expanded}
            onToggle={() => toggleSection(item.period)}
            onAdd={handleOpenAddSheet}
          />
        );
      }

      const step = item.step;
      const product = step.productId
        ? products.find((p) => p.id === step.productId) ?? null
        : null;

      if (!product) return null;

      // Last step of its period rounds the card's bottom corners, closes the
      // outline's bottom border, and adds the gap before the next period's
      // card — the header opens the outline's top border (see
      // PERIOD_CARD_BORDER_COLOR and SectionHeader).
      const index = getIndex();
      const nextRow = typeof index === 'number' ? rows[index + 1] : undefined;
      const isLastInPeriod = !nextRow || nextRow.kind === 'section';

      return (
        <ScaleDecorator>
          <View
            style={[
              styles.cardWrapper,
              { backgroundColor: PERIOD_BG[item.period] },
              isLastInPeriod && styles.cardWrapperLast,
            ]}
          >
            <RoutineStepCard
              product={product}
              onCardPress={() =>
                navigation.navigate('My Shelf', {
                  screen: 'ProductDetail',
                  params: { productId: product.id },
                })
              }
              conflictingProductName={conflictMap.get(step.id) ?? null}
              adaptationWeek={adaptationWeeks.get(product.id) ?? null}
              displayProductType={step.productType}
              // Long-press anywhere on the card lifts it into drag — no
              // separate edit mode to arm first (img-03).
              onLongPress={drag}
              onOverflowPress={() => openStepSheet(product, step.id, item.period)}
            />
            {/* Directly under the flagged makeup-remover/micellar-water
                step's own row — not a page-level banner (see
                findPreCleanseReminder). */}
            {preCleanseReminder?.stepId === step.id ? (
              <View style={styles.preCleanseReminderWrap}>
                <PreCleanseReminderCard reminder={preCleanseReminder} />
              </View>
            ) : null}
          </View>
        </ScaleDecorator>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openStepSheet reads routines from the closure below
    [conflictMap, adaptationWeeks, products, navigation, toggleSection, handleOpenAddSheet, morningRoutine, eveningRoutine, rows, preCleanseReminder],
  );

  const allFrozen = useMemo(() => [...frozenRows.values()].flat(), [frozenRows]);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        {/* Rehab shield anchors at the very top while a rehab window is live
            (research §1.5 V3); the blocks below render null when idle */}
        <RehabWidget state={rehabState} />
        {profile?.goalNeedsConfirmation === true && (
          <GoalConfirmBanner
            goalLabel={GOAL_LABELS[profile.primaryGoal]}
            onConfirm={() => updateProfile({ goalNeedsConfirmation: false })}
            onAdjust={() => navigation.navigate('Profile' as never)}
          />
        )}
        {profile?.phototypeNeedsConfirmation === true && (
          <PhototypeConfirmBanner
            fitzpatrick={profile.fitzpatrick}
            onConfirm={() => updateProfile({ phototypeNeedsConfirmation: false })}
            onAdjust={() => navigation.navigate('Profile' as never)}
          />
        )}
        <SeasonalNoticeBanner />
        <ClinicalRestrictionsBlock />
        <DuplicateSlotWarningInline
          routines={routines}
          products={products}
          onPressGroup={handlePressDuplicateGroup}
        />
        <PlannerBlock
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedDow={selectedDow}
          onDaySelect={handleDaySelect}
        />
      </View>
    ),
    [viewMode, selectedDow, handleDaySelect, rehabState, routines, products, handlePressDuplicateGroup, profile, updateProfile, navigation],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Routines"
        rightAction={
          <View style={styles.headerActions}>
            {/* Regenerate sits immediately left of "+", which stays rightmost
                so adding a product is always a single tap (img-03). */}
            <IconButton
              icon={<Feather name="refresh-cw" size={18} color={colors.textPrimary} />}
              label="Regenerate routine"
              variant="ghost"
              size="sm"
              onPress={handleOpenDraftPreview}
            />
            <IconButton
              icon={<Feather name="plus" size={18} color={colors.textPrimary} />}
              label="Add product to routine"
              variant="ghost"
              size="sm"
              onPress={handleOpenAddSheet}
            />
          </View>
        }
      />
      {viewMode === 'calendar' ? (
        <View style={styles.calendarWrap}>
          {/* Keep the sub-header so the user can toggle back to the list — the
              week strip is hidden here since the month grid below already
              shows every day (rendering both was a duplicate calendar). */}
          <View style={styles.calendarHeader}>
            <PlannerBlock
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              selectedDow={selectedDow}
              onDaySelect={handleDaySelect}
              showWeekStrip={false}
            />
          </View>
          <RoutineCalendarView
            routines={routines}
            products={products}
            onProductPress={openStepSheetForProduct}
            onAddProduct={handleOpenAddSheet}
          />
        </View>
      ) : (
      <DraggableFlatList
        // With no steps at all the section headers are noise — fall through to
        // the Generate card instead.
        data={totalSteps === 0 ? [] : rows}
        keyExtractor={routineRowKey}
        onDragEnd={({ data }) => handleDragEnd(data)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          <View style={styles.addProductFooter}>
            <PausedSteps frozen={allFrozen} products={products} />
            <Button
              variant="textActive"
              size="md"
              fullWidth
              icon={<Feather name="plus" size={16} color={palette.plum} />}
              onPress={handleOpenAddSheet}
              accessibilityLabel="Add product to routine"
            >
              Add product
            </Button>
            {totalSteps > 0 ? (
              <OptimizeStrip
                hasFindings={validation?.hasBlockingFindings ?? false}
                onPress={handleOpenDraftPreview}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          totalSteps === 0 ? (
            <GenerateCard
              onGenerate={handleOpenDraftPreview}
              onAddManually={handleOpenAddSheet}
            />
          ) : (
            <EmptyRoutine />
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      )}

      <AddToRoutineSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        // Both periods are visible now, so the sheet pre-selects the one the
        // time of day suggests — the same rule the accordions open with.
        activePeriod={defaultPeriod}
      />

      <DraftPreviewSheet
        visible={draft !== null}
        onClose={() => setDraft(null)}
        plan={draft?.proposedPlan ?? null}
        diff={draft?.diff ?? []}
        onCommit={handleCommitDraft}
        onSwapAlternative={handleSwapAlternative}
        onOverride={handleOverride}
      />

      <DuplicateSlotResolutionSheet
        visible={pendingDuplicateGroup !== null}
        onClose={() => setPendingDuplicateGroup(null)}
        routineId={duplicateResolution?.routineId ?? ''}
        slotLabel={duplicateResolution?.slotLabel ?? ''}
        rankedProducts={duplicateResolution?.rankedProducts ?? []}
      />

      <RoutineStepActionSheet
        product={sheetProduct}
        onViewDetails={(p) =>
          navigation.navigate('My Shelf', {
            screen: 'ProductDetail',
            params: { productId: p.id },
          })
        }
        onEdit={(p) =>
          navigation.navigate('My Shelf', {
            screen: 'ManualProductForm',
            params: { editingProductId: p.id },
          })
        }
        onRemoveFromRoutine={(p) => {
          // Drops the step only — the product stays on the shelf. The modal
          // then offers "this day" vs "every day".
          if (sheetStep) {
            setPendingRemoval({
              stepId: sheetStep.stepId,
              productId: p.id,
              productName: p.name,
              routineId: sheetStep.routineId,
            });
          }
        }}
        onHide={(_p) => {
          if (sheetStep) setStepHidden(sheetStep.routineId, sheetStep.stepId, true);
        }}
        onClose={closeStepSheet}
      />

      <RemoveStepModal
        visible={pendingRemoval !== null}
        productName={pendingRemoval?.productName ?? ''}
        dow={selectedDow}
        onRemoveDay={() => {
          if (pendingRemoval) {
            removeStepFromDay(pendingRemoval.routineId, pendingRemoval.stepId, selectedDow);
          }
          setPendingRemoval(null);
        }}
        onRemoveAll={() => {
          if (pendingRemoval) {
            removeProductStep(pendingRemoval.routineId, pendingRemoval.productId);
          }
          setPendingRemoval(null);
        }}
        onCancel={() => setPendingRemoval(null)}
      />
    </SafeAreaView>
  );
}

// ─── Accordion section header (img-03) ────────────────────────────────────────

interface SectionHeaderProps {
  period: Period;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
}

function SectionHeader({ period, count, expanded, onToggle, onAdd }: SectionHeaderProps) {
  const title = period === 'morning' ? 'Morning' : 'Evening';
  const stepLabel = `${count} ${count === 1 ? 'step' : 'steps'}`;
  // Collapsed, or expanded-but-empty: this header IS the whole card (no step
  // rows follow it), so it rounds all four corners itself. Otherwise it's
  // only the top of the card — the last step row rounds the bottom (see
  // renderItem's isLastInPeriod).
  const isStandaloneCard = !expanded || count === 0;

  return (
    <View
      style={[
        sectionStyles.wrap,
        { backgroundColor: PERIOD_BG[period] },
        sectionStyles.roundTop,
        isStandaloneCard && sectionStyles.roundBottom,
        isStandaloneCard && sectionStyles.cardGap,
      ]}
    >
      <Pressable
        style={sectionStyles.header}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}, ${stepLabel}, ${expanded ? 'expanded' : 'collapsed'}`}
      >
        <View style={sectionStyles.headerLeft}>
          <Feather
            name={period === 'morning' ? 'sun' : 'moon'}
            size={16}
            color={PERIOD_ICON_COLOR[period]}
          />
          <Text style={sectionStyles.title}>{title}</Text>
          <Text style={sectionStyles.count}>· {stepLabel}</Text>
        </View>
        <Feather
          name={expanded ? 'chevron-down' : 'chevron-right'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded && count === 0 ? (
        <View style={sectionStyles.empty}>
          <Text style={sectionStyles.emptyText}>
            No steps for this {period === 'morning' ? 'morning' : 'evening'}.
          </Text>
          <Button variant="textActive" size="sm" onPress={onAdd}>
            Add product
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space[3],
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: PERIOD_CARD_BORDER_COLOR,
  },
  roundTop: {
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  // Bottom border only when this header is the whole card (see
  // isStandaloneCard) — otherwise a step row below applies it instead.
  roundBottom: {
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    borderBottomWidth: 1,
  },
  // Gap before the NEXT period's card — only applied when this card ends
  // right here (collapsed or empty); otherwise the last step row applies it.
  cardGap: {
    marginBottom: space[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  title: {
    ...typography.body,
    fontFamily: 'DMSans-Bold',
    color: colors.textPrimary,
  },
  count: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  empty: {
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    gap: space[2],
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});

// ─── Paused rows (clinical freezes, research §1.5) ────────────────────────────

function PausedSteps({ frozen, products }: { frozen: FrozenStepView[]; products: Product[] }) {
  if (frozen.length === 0) return null;
  return (
    <View style={pausedStyles.wrap}>
      {frozen.map((item) => {
        const name = products.find((p) => p.id === item.productId)?.name ?? 'Product';
        return (
          <View key={item.stepId} style={pausedStyles.row}>
            <Feather name="pause-circle" size={14} color={colors.textTertiary} />
            <Text style={pausedStyles.text} numberOfLines={1}>
              {name} — paused until {item.until}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const pausedStyles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: space[3],
    gap: space[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  text: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    flexShrink: 1,
  },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyRoutine() {
  return (
    <View style={emptyStyles.wrap}>
      <Feather name="inbox" size={28} color={colors.textTertiary} />
      <Text style={emptyStyles.text}>No products scheduled for today.</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: space[12],
    gap: space[3],
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

// ─── Screen-level styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },

  listContent: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[6],
    paddingBottom: space[4],
  },

  calendarWrap: {
    flex: 1,
  },
  calendarHeader: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[6],
    paddingBottom: space[4],
  },

  listHeader: {
    marginBottom: space[4],
    gap: space[3],
  },

  // Tinted background (set inline per period) continues the period card's
  // color behind each step — the gap between product cards reads as a
  // colored gutter rather than a break in the card. Only the LAST step of a
  // period rounds the bottom corners and adds the gap to the next period.
  cardWrapper: {
    paddingHorizontal: space[3],
    paddingBottom: space[3],
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: PERIOD_CARD_BORDER_COLOR,
  },
  // Bottom border only on the period's last step row — everywhere else the
  // card's outline continues seamlessly into the next row (see the border-
  // vs-shadow rationale on PERIOD_CARD_BORDER_COLOR above).
  cardWrapperLast: {
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    borderBottomWidth: 1,
    marginBottom: space[4],
  },
  preCleanseReminderWrap: {
    marginTop: space[2],
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },

  addProductFooter: {
    paddingTop: space[4],
    paddingBottom: 40,
    gap: space[3],
  },
});
