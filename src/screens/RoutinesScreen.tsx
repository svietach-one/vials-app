import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import type { RenderItemParams } from 'react-native-draggable-flatlist';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';

import { AddToRoutineSheet } from '@/components/routine/AddToRoutineSheet';
import { DraftPreviewScreen } from '@/components/routine/DraftPreviewScreen';
import { DuplicateSlotResolutionSheet } from '@/components/routine/DuplicateSlotResolutionSheet';
import {
  DuplicateSlotWarningInline,
  type DuplicateSlotGroupPress,
} from '@/components/routine/DuplicateSlotWarningInline';
import { GenerateCard } from '@/components/routine/GenerateCard';
import { OptimizeStrip } from '@/components/routine/OptimizeStrip';
import { PreCleanseReminderCard } from '@/components/routine/PreCleanseReminderCard';
import { PlannerBlock, type RoutineViewMode } from '@/components/routine/PlannerBlock';
import { RehabNoticeCard } from '@/components/routine/RehabNoticeCard';
import { RoutineCalendarView } from '@/components/routine/RoutineCalendarView';
import { RemoveStepModal } from '@/components/routine/RemoveStepModal';
import { RoutineStepActionSheet } from '@/components/routine/RoutineStepActionSheet';
import { RoutineStepCard } from '@/components/routine/RoutineStepCard';
import { GoalConfirmBanner } from '@/components/routine/GoalConfirmBanner';
import { PhototypeConfirmBanner } from '@/components/routine/PhototypeConfirmBanner';
import { ConflictWarningInline } from '@/components/routine/ConflictWarningInline';
import { SeasonalNoticeBanner } from '@/components/routine/SeasonalNoticeBanner';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { getSlotCategoryLabel, GOAL_LABELS } from '@/constants/labels';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
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
import { getRecoveryConditionCaution } from '@/utils/skinConditionModifiers';
import { reclassifyMakeupRemover } from '@/utils/productForm/categoryDetector';
import { isScheduledOnDay } from '@/utils/routineSchedule';
import {
  mergeReorderedSteps,
  resolveAccordionState,
  toPersistedAccordionState,
  type AccordionState,
} from '@/utils/routineAccordion';
import {
  resolveRehabNoticeCollapsed,
  toRehabNoticeCollapseEntry,
} from '@/utils/rehabNoticeCollapse';
import { getAdaptationStatus } from '@/utils/routineEngine/adaptation';
import { buildRoutineContext } from '@/utils/routineEngine/context';
import { getDailyView, type FrozenStepView } from '@/utils/routineEngine/dailyView';
import { rankSlotGroup } from '@/utils/routineEngine/duplicateSlot';
import { applySlotAlternativeSwap } from '@/utils/routineEngine/planApply';
import { findPreCleanseReminder } from '@/utils/routineEngine/preCleanseReminder';
import { buildProductFacts, buildShelfFacts } from '@/utils/routineEngine/productFacts';
import { buildRehabNotices } from '@/utils/routineEngine/rehabFilter';
import type { ValidationResult } from '@/utils/routineEngine/validate';
import type { Product, RoutineStep } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = BottomTabScreenProps<RootTabParamList, 'Routines'>;
type Period = 'morning' | 'evening';

// ─── Period card colors ─────────────────────────────────────────────────────
// Each period (Morning / Evening) renders as ONE real card View — a proper
// nested container with a single hairline border + one even drop shadow
// (shadow.md, all four sides), exactly like every other card in the app. Its
// steps drag inside a NestableDraggableFlatList so the card can be a genuine
// wrapper without competing with the outer NestableScrollContainer for the
// long-press gesture. This replaced an earlier design that faked the card
// across separate flat-list rows and could only ever cast a cropped,
// bottom-only shadow.
//
// Morning and evening share ONE background color (PERIOD_CARD_BG) rather than
// distinct tints — two hues read fine on their own, but clash badly the
// moment an amber notification card (PreCleanseReminderCard) sits inside one
// of them. The sun/moon header icons keep their own color (PERIOD_ICON_COLOR)
// so the periods stay visually distinguishable at a glance: marigold sun on a
// light-orange disc, cobalt moon on a light-blue one — the same pairing the
// calendar lanes and My Shelf badges use.
const PERIOD_CARD_BG = palette.boneDeep;
const PERIOD_ICON_COLOR: Record<Period, string> = {
  morning: palette.marigold,
  evening: palette.cobalt,
};
// Same circle treatment as the sun/moon overlay badges on My Shelf's
// ProductShelfCard (circleBadge/circleBadgeSun/circleBadgeMoon).
const PERIOD_ICON_BG: Record<Period, string> = {
  morning: palette.marigoldTint,
  evening: palette.cobaltTint,
};
const PERIOD_CARD_BORDER_COLOR = 'rgba(9, 9, 11, 0.08)';

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
  const persistedAccordion = useSettingsStore((s) => s.routineAccordion);
  const setRoutineAccordion = useSettingsStore((s) => s.setRoutineAccordion);
  const persistedRehabCollapse = useSettingsStore((s) => s.rehabNoticeCollapsed);
  const setRehabNoticeCollapsed = useSettingsStore((s) => s.setRehabNoticeCollapsed);

  const [viewMode, setViewMode] = useState<RoutineViewMode>('list');
  // The AM/PM auto-decision (before 15:00 Morning open, after it Evening) only
  // fires once per skincare day — today's persisted snapshot wins over it if
  // one exists, so a manual collapse survives a remount for the rest of the
  // day. Read once on mount; settings are already hydrated by the time this
  // screen exists (App gates rendering on storesReady).
  const [expanded, setExpanded] = useState<AccordionState>(() =>
    resolveAccordionState(persistedAccordion),
  );

  // Persists on mount (recording the day's auto-decision, if it wasn't
  // already recorded) and after every manual toggle below, so a remount later
  // the same skincare day reuses this exact snapshot instead of re-deciding
  // from the 15:00 AM/PM rule.
  useEffect(() => {
    setRoutineAccordion(toPersistedAccordionState(expanded));
  }, [expanded, setRoutineAccordion]);
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
  const { adaptationWeeks, frozenRows, rehabNotices } = useMemo(() => {
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
      rehabNotices: buildRehabNotices(procedures),
    };
  }, [products, routines, procedures, profile, cycleType, applicationStats]);

  const { amSteps, pmSteps, conflictMap } = useMemo(() => {
    // Clinically frozen steps leave the visible list (research §1.5: the
    // rehab notice + Paused rows explain them — never silent, never draggable)
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

  // Computed once here (not inside PreCleanseReminderCard) so renderItem can
  // match reminder.stepId against each step it renders and place the card
  // directly under that specific step's own row.
  const preCleanseReminder = useMemo(
    () => findPreCleanseReminder(routines, products),
    [routines, products],
  );

  // Each period drags within its own NestableDraggableFlatList — cross-period
  // (AM↔PM) drag is not a thing here, so the reordered array is simply that
  // period's visible steps in their new order.
  function handleDragEndForPeriod(period: Period, reordered: RoutineStep[]) {
    const routine = period === 'morning' ? morningRoutine : eveningRoutine;
    if (!routine) return;
    const merged = mergeReorderedSteps(routine.steps, reordered);
    if (merged) reorderSteps(routine.id, merged);
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

  // One step inside a period card. Each period owns its own
  // NestableDraggableFlatList, so `item` is a RoutineStep (not a section row)
  // and drag is scoped to that period.
  const renderStepItem = useCallback(
    (period: Period) =>
      ({ item: step, drag }: RenderItemParams<RoutineStep>) => {
        const product = step.productId
          ? products.find((p) => p.id === step.productId) ?? null
          : null;
        if (!product) return null;

        return (
          <ScaleDecorator>
            <View style={styles.stepRowWrap}>
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
                // Older manually-added steps can carry a stale `cleanser`
                // productType for what is actually a micellar water / makeup
                // remover (reclassifyMakeupRemover only ran at generate-time
                // historically) — reclassify from the current catalog record
                // so the badge is honest regardless of which routine or when
                // the step was created.
                displayProductType={reclassifyMakeupRemover(product).productType}
                // Long-press anywhere on the card lifts it into drag — no
                // separate edit mode to arm first (img-03).
                onLongPress={drag}
                onOverflowPress={() => openStepSheet(product, step.id, period)}
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
    [conflictMap, adaptationWeeks, products, navigation, preCleanseReminder, morningRoutine, eveningRoutine],
  );

  const allFrozen = useMemo(() => [...frozenRows.values()].flat(), [frozenRows]);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        {/* Calendar (view toggle + week strip) sits at the top; the
            notification blocks below it render null when idle and each can be
            collapsed to its header line to save space (img-03 follow-up). */}
        <PlannerBlock
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedDow={selectedDow}
          onDaySelect={handleDaySelect}
        />
        {/* One merged card per procedure in rehab (shield + acute lifestyle
            restrictions in a single card; the two former cards would read as
            needlessly anxious). Self-destructs when its window ends. */}
        {rehabNotices.map((notice) => {
          const collapsed = resolveRehabNoticeCollapsed(persistedRehabCollapse[notice.key]);
          return (
            <RehabNoticeCard
              key={notice.key}
              notice={notice}
              collapsed={collapsed}
              onToggleCollapse={() =>
                setRehabNoticeCollapsed(notice.key, toRehabNoticeCollapseEntry(!collapsed))
              }
              conditionCaution={getRecoveryConditionCaution(profile?.skinConditions ?? [], {
                aggressive: notice.aggressive,
                phase: 'rehab',
              })}
            />
          );
        })}
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
        <DuplicateSlotWarningInline
          routines={routines}
          products={products}
          onPressGroup={handlePressDuplicateGroup}
        />
        {/* Pairwise conflicts + (v1.2) condition advisories and density
            insights. Fed the SAME visible steps the list renders — so it can
            never warn about a step a clinical freeze has already removed.
            Advisory only — never blocks. */}
        <ConflictWarningInline
          morningSteps={amSteps}
          eveningSteps={pmSteps}
          products={products}
          skinConditions={profile?.skinConditions ?? []}
        />
      </View>
    ),
    [
      viewMode,
      selectedDow,
      handleDaySelect,
      rehabNotices,
      routines,
      amSteps,
      pmSteps,
      products,
      handlePressDuplicateGroup,
      profile,
      updateProfile,
      navigation,
      persistedRehabCollapse,
      setRehabNoticeCollapsed,
    ],
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
              icon={<Icon name="refresh-cw" size={18} color={colors.textPrimary} />}
              label="Regenerate routine"
              variant="ghost"
              size="sm"
              onPress={handleOpenDraftPreview}
            />
            <IconButton
              icon={<Icon name="plus" size={18} color={colors.textPrimary} />}
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
      <NestableScrollContainer
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {listHeader}

        {totalSteps === 0 ? (
          // With no steps at all the period cards are noise — fall through to
          // the Generate card instead.
          <GenerateCard
            onGenerate={handleOpenDraftPreview}
            onAddManually={handleOpenAddSheet}
          />
        ) : (
          <>
            <PeriodCard
              period="morning"
              count={amSteps.length}
              expanded={expanded.morning}
              steps={amSteps}
              renderStep={renderStepItem('morning')}
              onToggle={() => toggleSection('morning')}
              onAdd={handleOpenAddSheet}
              onDragEnd={(data) => handleDragEndForPeriod('morning', data)}
            />
            <PeriodCard
              period="evening"
              count={pmSteps.length}
              expanded={expanded.evening}
              steps={pmSteps}
              renderStep={renderStepItem('evening')}
              onToggle={() => toggleSection('evening')}
              onAdd={handleOpenAddSheet}
              onDragEnd={(data) => handleDragEndForPeriod('evening', data)}
            />
          </>
        )}

        <View style={styles.addProductFooter}>
          <PausedSteps frozen={allFrozen} products={products} />
          <Button
            variant="textActive"
            size="md"
            fullWidth
            icon={<Icon name="plus" size={16} color={palette.plum} />}
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
      </NestableScrollContainer>
      )}

      <AddToRoutineSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        // Both periods are visible now, so the sheet pre-selects the one the
        // time of day suggests — the same rule the accordions open with.
        activePeriod={defaultPeriod}
      />

      <DraftPreviewScreen
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

// ─── Period card (one real container per Morning / Evening) ───────────────────

interface PeriodCardProps {
  period: Period;
  count: number;
  expanded: boolean;
  steps: RoutineStep[];
  renderStep: (info: RenderItemParams<RoutineStep>) => React.ReactElement | null;
  onToggle: () => void;
  onAdd: () => void;
  onDragEnd: (reordered: RoutineStep[]) => void;
}

function PeriodCard({
  period,
  count,
  expanded,
  steps,
  renderStep,
  onToggle,
  onAdd,
  onDragEnd,
}: PeriodCardProps) {
  const title = period === 'morning' ? 'Morning' : 'Evening';
  const stepLabel = `${count} ${count === 1 ? 'step' : 'steps'}`;

  return (
    <View style={periodCardStyles.card}>
      <Pressable
        style={periodCardStyles.header}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}, ${stepLabel}, ${expanded ? 'expanded' : 'collapsed'}`}
      >
        <View style={periodCardStyles.headerLeft}>
          <View style={[periodCardStyles.periodIconCircle, { backgroundColor: PERIOD_ICON_BG[period] }]}>
            <Icon
              name={period === 'morning' ? 'sun' : 'moon'}
              size={14}
              color={PERIOD_ICON_COLOR[period]}
            />
          </View>
          <Text style={periodCardStyles.title}>{title}</Text>
          <Text style={periodCardStyles.count}>· {stepLabel}</Text>
        </View>
        <Icon
          name={expanded ? 'chevron-down' : 'chevron-right'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded && count === 0 ? (
        <View style={periodCardStyles.empty}>
          <Text style={periodCardStyles.emptyText}>
            No steps for this {period === 'morning' ? 'morning' : 'evening'}.
          </Text>
          <Button variant="textActive" size="sm" onPress={onAdd}>
            Add product
          </Button>
        </View>
      ) : null}

      {expanded && count > 0 ? (
        <View style={periodCardStyles.body}>
          <NestableDraggableFlatList
            data={steps}
            keyExtractor={(step) => step.id}
            renderItem={renderStep}
            onDragEnd={({ data }) => onDragEnd(data)}
            activationDistance={12}
          />
        </View>
      ) : null}
    </View>
  );
}

const periodCardStyles = StyleSheet.create({
  // One real card: single hairline border + one even drop shadow, all four
  // sides — the same treatment as every other card in the app.
  card: {
    backgroundColor: PERIOD_CARD_BG,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: PERIOD_CARD_BORDER_COLOR,
    paddingHorizontal: space[3],
    marginBottom: space[4],
    ...shadow.md,
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
  // Matches ProductShelfCard's circleBadge (My Shelf sun/moon overlay badges).
  periodIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Steps live below the header inside the same card; the last step's own
  // marginBottom supplies the gap to the card's bottom edge.
  body: {
    paddingBottom: space[1],
  },
  empty: {
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    gap: space[2],
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    marginBottom: space[3],
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
            <Icon name="pause-circle" size={14} color={colors.textTertiary} />
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

  // Gap between step mini-cards inside a period card; the last step's bottom
  // margin doubles as the card's inner bottom padding.
  stepRowWrap: {
    marginBottom: space[3],
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
