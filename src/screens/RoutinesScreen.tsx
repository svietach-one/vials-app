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
  groupHasActiveIngredientOverlap,
  type DuplicateSlotGroupPress,
} from '@/components/routine/DuplicateSlotWarningInline';
import { GapCard } from '@/components/routine/GapCard';
import { GenerateCard } from '@/components/routine/GenerateCard';
import { OptimizeStrip } from '@/components/routine/OptimizeStrip';
import { OrphanedSlotCard } from '@/components/routine/OrphanedSlotCard';
import { PreCleanseReminderCard } from '@/components/routine/PreCleanseReminderCard';
import { PlannerBlock } from '@/components/routine/PlannerBlock';
import { RehabNoticeCard } from '@/components/routine/RehabNoticeCard';
import { RoutineCalendarView } from '@/components/routine/RoutineCalendarView';
import { RemoveStepModal } from '@/components/routine/RemoveStepModal';
import { RoutineProductCard } from '@/components/routine/RoutineProductCard';
import { RoutineSchedulerSheet } from '@/components/routine/RoutineSchedulerSheet';
import { RoutineStepActionSheet } from '@/components/routine/RoutineStepActionSheet';
import { StepGroupHeader } from '@/components/routine/StepGroupHeader';
import { StepTransitionDivider } from '@/components/routine/StepTransitionDivider';
import { GoalConfirmBanner } from '@/components/routine/GoalConfirmBanner';
import { GoalCoverageBanner } from '@/components/routine/GoalCoverageBanner';
import { PhototypeConfirmBanner } from '@/components/routine/PhototypeConfirmBanner';
import { ConflictWarningInline } from '@/components/routine/ConflictWarningInline';
import { SeasonalNoticeBanner } from '@/components/routine/SeasonalNoticeBanner';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { PillToggle } from '@/components/ui/core/PillToggle';
import { getSlotCategoryLabel, GOAL_LABELS, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { reasonText } from '@/constants/decisionReasons';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { RootTabParamList } from '@/navigation/AppNavigator';
import {
  applyRoutinePlan,
  currentOverrideHash,
  validateCurrentRoutines,
  type PlanCommitScope,
} from '@/domain/routinePlanActions';
import { getActiveSeasonMask } from '@/domain/seasonActions';
import { useCompletionStore } from '@/store/completionStore';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrackingStore } from '@/store/trackingStore';
import { ConflictEngine } from '@/utils/conflictEngine';
import { getRecoveryConditionCaution } from '@/utils/skinConditionModifiers';
import { reclassifyMakeupRemover } from '@/utils/productForm/categoryDetector';
import { dateForDow, isScheduledOnDay } from '@/utils/routineSchedule';
import { getSkincareDateString } from '@/utils/timeHelpers';
import {
  attachPlaceholderGaps,
  groupStepsIntoActions,
  isGroupAllCompleted,
  resolveTransition,
  type RenderGroup,
} from '@/utils/routineGrouping';
import {
  mergeReorderedSteps,
  resolveAccordionState,
  toPersistedAccordionState,
} from '@/utils/routineAccordion';
import {
  resolveNoticeCollapsed,
  toNoticeCollapseEntry,
} from '@/utils/noticeCollapse';
import { getAdaptationStatus } from '@/utils/routineEngine/adaptation';
import { buildRoutineContext } from '@/utils/routineEngine/context';
import { getDailyView, type FrozenStepView } from '@/utils/routineEngine/dailyView';
import { findSlotDuplicateGroups, rankSlotGroup } from '@/utils/routineEngine/duplicateSlot';
import { applySlotAlternativeSwap } from '@/utils/routineEngine/planApply';
import type { PlaceholderSlot } from '@/utils/routineEngine/planTypes';
import { findPreCleanseReminder } from '@/utils/routineEngine/preCleanseReminder';
import { buildProductFacts, buildShelfFacts } from '@/utils/routineEngine/productFacts';
import { buildRehabNotices } from '@/utils/routineEngine/rehabFilter';
import type { ValidationResult } from '@/utils/routineEngine/validate';
import type { GoalCoverageInput } from '@/utils/goalCoverage';
import type { Product, ProductType, Routine, RoutineStep } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = BottomTabScreenProps<RootTabParamList, 'Routines'>;
type Period = 'morning' | 'evening';
/** List ⇄ calendar switch, now driven from AppHeader's leftAction. */
type ViewMode = 'list' | 'calendar';

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
  const gamificationEnabled = useSettingsStore((s) => s.gamificationEnabled);
  const applicationStats = useTrackingStore((s) => s.applicationStats);
  const reorderSteps = useRoutinesStore((s) => s.reorderSteps);
  const removeStepFromDay = useRoutinesStore((s) => s.removeStepFromDay);
  const removeProductStep = useRoutinesStore((s) => s.removeProductStep);
  const setStepHidden = useRoutinesStore((s) => s.setStepHidden);
  const persistedAccordion = useSettingsStore((s) => s.routineAccordion);
  const setRoutineAccordion = useSettingsStore((s) => s.setRoutineAccordion);
  const persistedRehabCollapse = useSettingsStore((s) => s.rehabNoticeCollapsed);
  const setRehabNoticeCollapsed = useSettingsStore((s) => s.setRehabNoticeCollapsed);
  const isCompleted = useCompletionStore((s) => s.isCompleted);
  const toggleCompleted = useCompletionStore((s) => s.toggleCompleted);
  // `isCompleted`/`toggleCompleted` are stable function references from the
  // store creator — selecting them alone never changes by Object.is, so
  // Zustand's useSyncExternalStore-based subscription never re-renders this
  // screen when toggleCompleted mutates `completions`. Subscribing to the
  // array itself (even though it's read only indirectly, via isCompleted
  // closures below) gives this component a real subscription: its identity
  // changes on every toggle, forcing the re-render that makes a tap show up
  // immediately instead of only on the next unrelated re-render.
  const completions = useCompletionStore((s) => s.completions);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // routine-step-grouping follow-up: the Morning/Evening accordion (both
  // periods mounted, independently expandable) is retired in favor of a
  // single active period chosen by a segmented control (mockup-driven
  // reversal of the img-03 accordion redesign — human-confirmed, see
  // progress/routine-step-grouping.md). `resolveAccordionState`/
  // `toPersistedAccordionState`/`AccordionState` are kept exactly as they
  // are — still the 15:00 AM/PM rule plus "today's snapshot wins" — but the
  // pair of booleans they carry is now read as "which ONE period is
  // selected" instead of "which are independently expanded" (the invariant
  // that exactly one is true still holds, so the persisted shape needs no
  // migration). Read once on mount; settings are already hydrated by the
  // time this screen exists (App gates rendering on storesReady).
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(
    () => (resolveAccordionState(persistedAccordion).morning ? 'morning' : 'evening'),
  );

  // Persists on mount (recording the day's auto-decision, if it wasn't
  // already recorded) and after every manual segment tap below, so a remount
  // later the same skincare day reuses this exact snapshot instead of
  // re-deciding from the 15:00 AM/PM rule.
  useEffect(() => {
    setRoutineAccordion(
      toPersistedAccordionState({ morning: selectedPeriod === 'morning', evening: selectedPeriod === 'evening' }),
    );
  }, [selectedPeriod, setRoutineAccordion]);
  const [selectedDow, setSelectedDow] = useState<number>(() => new Date().getDay());
  // routine-step-grouping US-40: future/past-day completion gating needs a
  // real calendar Date, not just a day-of-week — PlannerBlock already derives
  // one per day-chip internally (dateForDow, shared so the two never drift).
  const selectedDate = dateForDow(selectedDow);
  const isFutureSelection = selectedDate.getTime() > new Date().getTime();
  const selectedSkincareDate = getSkincareDateString(selectedDate);
  const tappable = gamificationEnabled && !isFutureSelection;
  const [editMode, setEditMode] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const [sheetStep, setSheetStep] = useState<{ stepId: string; routineId: string } | null>(null);
  const [schedulerTarget, setSchedulerTarget] = useState<{ productId: string; productType: ProductType } | null>(
    null,
  );
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

  // Single shared entry point for both the header "+" and the in-content
  // "Add product" button — both must open the exact same flow.
  const handleOpenAddSheet = useCallback(() => {
    setAddSheetVisible(true);
  }, []);

  const handleFindInCatalog = useCallback(() => {
    navigation.navigate('My Shelf', { screen: 'Catalog' });
  }, [navigation]);

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

  const placeholders: PlaceholderSlot[] = validation?.proposedPlan.placeholders ?? [];

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
      profile: {
        fitzpatrick: profile?.fitzpatrick ?? null,
        pregnantOrBreastfeeding: profile?.pregnantOrBreastfeeding ?? false,
      },
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

  const { amSteps, pmSteps, conflictMap, similarMap } = useMemo(() => {
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

    // Per-card echo of DuplicateSlotWarningInline's top-of-screen banner
    // (Change 1, routine-step-grouping polish round 3): same detection
    // primitive (findSlotDuplicateGroups), but scoped to each period's own
    // already-filtered `am`/`pm` steps — never routine.steps unfiltered like
    // the banner — so the per-card tip never contradicts what's actually
    // rendered today. One other product name per step, same "first found
    // wins" simplicity as conflictMap above.
    const similar = new Map<string, string>();
    for (const periodSteps of [am, pm]) {
      for (const group of findSlotDuplicateGroups(periodSteps, products)) {
        if (!groupHasActiveIngredientOverlap(group, products)) continue;
        for (const step of group) {
          if (similar.has(step.id)) continue;
          const other = group.find((s) => s.id !== step.id);
          const otherProduct = other?.productId ? products.find((p) => p.id === other.productId) : null;
          if (otherProduct) similar.set(step.id, otherProduct.name);
        }
      }
    }

    return { amSteps: am, pmSteps: pm, conflictMap: map, similarMap: similar };
  }, [routines, products, selectedDow, frozenRows]);

  // routine-step-grouping Phase 2/4: group each period's visible steps into
  // render-time StepAction groups, then attach any unfilled generator
  // placeholders as gap cards (US-44). `steps` is already the fully
  // period/weekday/hidden/frozen-filtered list, so grouping/transitions never
  // see a step that isn't actually rendered today.
  const amRenderGroups = useMemo(() => {
    const base = groupStepsIntoActions(amSteps, products);
    return attachPlaceholderGaps(base, placeholders.filter((p) => p.period === 'am'));
  }, [amSteps, products, placeholders]);
  const pmRenderGroups = useMemo(() => {
    const base = groupStepsIntoActions(pmSteps, products);
    return attachPlaceholderGaps(base, placeholders.filter((p) => p.period === 'pm'));
  }, [pmSteps, products, placeholders]);

  // Single-active-period rendering: only the segmented control's current
  // selection is ever mounted in the draggable list below.
  const activeRenderGroups = selectedPeriod === 'morning' ? amRenderGroups : pmRenderGroups;
  const activeHasContent =
    activeRenderGroups.groups.length > 0 || activeRenderGroups.extraGroups.length > 0;

  // Computed once here (not inside PreCleanseReminderCard) so renderItem can
  // match reminder.stepId against each step it renders and place the card
  // directly under that specific step's own row.
  const preCleanseReminder = useMemo(
    () => findPreCleanseReminder(routines, products),
    [routines, products],
  );

  // Each period drags within its own NestableDraggableFlatList — cross-period
  // (AM↔PM) drag is not a thing here, so the reordered array is simply that
  // period's visible steps in their new order. Operates on GROUPS: dragging a
  // group moves all of its member steps together, preserving their internal
  // order (PRD_Spec.md §7.1).
  function handleDragEndForPeriod(period: Period, reorderedGroups: RenderGroup[]) {
    const routine = period === 'morning' ? morningRoutine : eveningRoutine;
    if (!routine) return;
    const reorderedSteps = reorderedGroups.flatMap((g) => g.members.map((m) => m.step));
    const merged = mergeReorderedSteps(routine.steps, reorderedSteps);
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

  // One product card (or orphaned-slot card) inside a rendered step group.
  const renderGroupMember = useCallback(
    (member: RenderGroup['members'][number], period: Period, routine: Routine) => {
      const { step, product } = member;

      if (!product) {
        return (
          <View key={step.id} style={styles.stepRowWrap}>
            <OrphanedSlotCard
              onAddFromCatalog={handleOpenAddSheet}
              onPause={() => setStepHidden(routine.id, step.id, true)}
            />
          </View>
        );
      }

      const completed = isCompleted(product.id, routine.id, selectedSkincareDate);

      return (
        <View key={step.id} style={styles.stepRowWrap}>
          <RoutineProductCard
            product={product}
            // Older manually-added steps can carry a stale `cleanser`
            // productType for what is actually a micellar water / makeup
            // remover (reclassifyMakeupRemover only ran at generate-time
            // historically) — reclassify from the current catalog record so
            // the badge is honest regardless of which routine or when the
            // step was created.
            displayProductType={reclassifyMakeupRemover(product).productType}
            completed={completed}
            editMode={editMode}
            tappable={tappable}
            onToggleComplete={() => toggleCompleted(product.id, routine.id, selectedSkincareDate)}
            onOpenActionSheet={() => openStepSheet(product, step.id, period)}
            onPausePress={() => setStepHidden(routine.id, step.id, true)}
            onSchedulePress={() => setSchedulerTarget({ productId: product.id, productType: product.productType })}
            conflictingProductName={conflictMap.get(step.id) ?? null}
            similarProductName={similarMap.get(step.id) ?? null}
            adaptationWeek={adaptationWeeks.get(product.id) ?? null}
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
      );
    },
    [
      handleOpenAddSheet,
      setStepHidden,
      isCompleted,
      editMode,
      tappable,
      toggleCompleted,
      completions,
      selectedSkincareDate,
      conflictMap,
      similarMap,
      adaptationWeeks,
      preCleanseReminder,
    ],
  );

  function renderGaps(group: RenderGroup) {
    return group.gaps.map((gap, index) => (
      <View key={`gap-${gap.reasonCode}-${index}`} style={styles.stepRowWrap}>
        <GapCard
          label={PRODUCT_TYPE_LABELS[gap.productTypes[0]] ?? gap.productTypes[0]}
          onFindInCatalog={handleFindInCatalog}
        />
      </View>
    ));
  }

  // One step GROUP inside a period's draggable list. Each period owns its
  // own NestableDraggableFlatList, so `item` is a RenderGroup (a StepAction
  // bucket, not an individual product) and drag reorders whole groups.
  const renderGroupItem = useCallback(
    (period: Period, groups: RenderGroup[]) =>
      ({ item: group, drag, getIndex }: RenderItemParams<RenderGroup>) => {
        const routine = period === 'morning' ? morningRoutine : eveningRoutine;
        if (!routine) return null;

        const index = getIndex?.() ?? groups.indexOf(group);
        const ordinal = index + 1;
        const next = index < groups.length - 1 ? groups[index + 1] : null;
        const transition = resolveTransition(group, next);
        const allCompleted =
          group.members.length > 0 &&
          isGroupAllCompleted(group, (m) => (m.product ? isCompleted(m.product.id, routine.id, selectedSkincareDate) : false));

        return (
          <ScaleDecorator>
            <View style={styles.groupWrap}>
              <Pressable
                onLongPress={editMode ? drag : undefined}
                disabled={!editMode}
                style={styles.groupHeaderWrap}
              >
                <StepGroupHeader ordinal={ordinal} action={group.action} allCompleted={allCompleted} editMode={editMode} />
              </Pressable>
              {group.members.map((member) => renderGroupMember(member, period, routine))}
              {renderGaps(group)}
              {gamificationEnabled ? <StepTransitionDivider transition={transition} /> : null}
            </View>
          </ScaleDecorator>
        );
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- renderGaps/renderGroupMember close over deps already listed on their own memo
    [morningRoutine, eveningRoutine, editMode, isCompleted, completions, selectedSkincareDate, gamificationEnabled, renderGroupMember],
  );

  // Gap-only synthetic groups (a generator placeholder whose action has no
  // real step group yet) — no persisted steps to drag, so rendered as a
  // static trailing block rather than inside the draggable list.
  function renderExtraGroups(groups: RenderGroup[], extraGroups: RenderGroup[]) {
    return extraGroups.map((group, i) => (
      <View key={`extra-${group.action}`} style={styles.groupWrap}>
        <StepGroupHeader ordinal={groups.length + i + 1} action={group.action} editMode={editMode} />
        {renderGaps(group)}
      </View>
    ));
  }

  const allFrozen = useMemo(() => [...frozenRows.values()].flat(), [frozenRows]);

  // engine4.1 §3: resolves goals + pregnancyRules ONCE via buildRoutineContext
  // (never per-goal — that would break the barrier_repair cross-goal
  // modifier), then feeds it plus the currently-visible steps and the full
  // shelf to getGoalCoverageFindings. amSteps/pmSteps are already the
  // frozen/hidden-filtered visible list, so "covered" can never credit a
  // product the routine isn't actually showing today.
  const goalCoverageInput = useMemo((): GoalCoverageInput | null => {
    if (!profile) return null;
    const context = buildRoutineContext({
      procedures,
      profile: {
        fitzpatrick: profile.fitzpatrick,
        primaryGoal: profile.primaryGoal,
        secondaryGoal: profile.secondaryGoal,
        pregnantOrBreastfeeding: profile.pregnantOrBreastfeeding,
      },
      seasonMask: getActiveSeasonMask(),
    });
    const scheduledProducts = [...amSteps, ...pmSteps]
      .map((s) => (s.productId ? products.find((p) => p.id === s.productId) : undefined))
      .filter((p): p is Product => p !== undefined);

    return {
      primaryGoal: profile.primaryGoal,
      secondaryGoal: profile.secondaryGoal,
      goalNeedsConfirmation: profile.goalNeedsConfirmation,
      treatmentClassRanking: context.treatmentClassRanking,
      scheduledProducts,
      products,
      pregnancyRules: context.pregnancyRules,
    };
  }, [profile, procedures, amSteps, pmSteps, products]);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        {/* Morning/Evening segmented switch — replaces the former
            independently-expandable accordion (mockup-driven reversal, see
            progress/routine-step-grouping.md). Reuses PillToggle, the same
            full-width plum segmented-pill atom that used to power this
            screen's own List/Calendar toggle (now in AppHeader's
            leftAction) and Clinic's Active/History tabs — it already has an
            icon slot, so no new atom was needed. */}
        <PillToggle
          value={selectedPeriod}
          onValueChange={(v) => setSelectedPeriod(v as Period)}
          options={[
            {
              value: 'morning',
              label: 'Morning',
              accessibilityLabel: 'Morning',
              icon: (active) => (
                <Icon name="sun" size={16} color={active ? palette.white : colors.textSecondary} />
              ),
            },
            {
              value: 'evening',
              label: 'Evening',
              accessibilityLabel: 'Evening',
              icon: (active) => (
                <Icon name="moon" size={16} color={active ? palette.white : colors.textSecondary} />
              ),
            },
          ]}
        />
        {/* Week strip below the period switch; the notification blocks
            below it render null when idle and each can be collapsed to its
            header line to save space (img-03 follow-up). */}
        <PlannerBlock selectedDow={selectedDow} onDaySelect={handleDaySelect} />
        {/* One merged card per procedure in rehab (shield + acute lifestyle
            restrictions in a single card; the two former cards would read as
            needlessly anxious). Self-destructs when its window ends. */}
        {rehabNotices.map((notice) => {
          const collapsed = resolveNoticeCollapsed(persistedRehabCollapse[notice.key]);
          return (
            <RehabNoticeCard
              key={notice.key}
              notice={notice}
              collapsed={collapsed}
              onToggleCollapse={() =>
                setRehabNoticeCollapsed(notice.key, toNoticeCollapseEntry(!collapsed))
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
        {goalCoverageInput ? <GoalCoverageBanner input={goalCoverageInput} /> : null}
        <DuplicateSlotWarningInline
          routines={routines}
          products={products}
          onPressGroup={handlePressDuplicateGroup}
        />
        {/* Pairwise conflicts + (v1.2) condition advisories and density
            insights. Advisory only — never blocks.
            Two different scoping rules on purpose:
            - morningSteps/eveningSteps (condition advisories + density) are
              scoped to ONLY the currently selected period — since Phase 7
              replaced the always-both-visible accordion with a
              single-active-period PillToggle, feeding both periods here made
              the banner reference products with zero presence in the period
              actually on screen (e.g. an evening-only retinoid still showing
              its advisory while Morning is selected).
            - allSteps (pairwise ingredient conflicts) is always BOTH
              periods, regardless of selectedPeriod — a real AM+PM chemistry
              conflict must fire no matter which tab is open; scoping it to
              the active tab too silently disabled cross-period conflict
              detection entirely (progress/routine-step-grouping.md,
              code-review round 2026-08-31). */}
        <ConflictWarningInline
          morningSteps={selectedPeriod === 'morning' ? amSteps : []}
          eveningSteps={selectedPeriod === 'evening' ? pmSteps : []}
          allSteps={[...amSteps, ...pmSteps]}
          products={products}
          skinConditions={profile?.skinConditions ?? []}
        />
      </View>
    ),
    [
      selectedPeriod,
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
      goalCoverageInput,
    ],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Routine"
        leftAction={
          // Replaces PlannerBlock's former internal List/Calendar PillToggle
          // — Regenerate and Add moved out of the header entirely (the
          // footer's OptimizeStrip and "Add product" button already call the
          // same handlers, so this is a single-tap flow either way).
          <IconButton
            icon={<Icon name={viewMode === 'calendar' ? 'list' : 'calendar'} size={18} color={colors.textPrimary} />}
            label={viewMode === 'calendar' ? 'List view' : 'Calendar view'}
            variant="ghost"
            size="sm"
            onPress={() => setViewMode((v) => (v === 'calendar' ? 'list' : 'calendar'))}
          />
        }
        rightAction={
          <IconButton
            icon={
              <Icon
                name={editMode ? 'check' : 'edit-2'}
                size={18}
                color={colors.textPrimary}
              />
            }
            label={editMode ? 'Done editing' : 'Edit routine'}
            variant="ghost"
            size="sm"
            onPress={() => setEditMode((v) => !v)}
          />
        }
      />
      {viewMode === 'calendar' ? (
        <View style={styles.calendarWrap}>
          {/* The List ⇄ Calendar switch now lives permanently in AppHeader's
              leftAction, so there is nothing left for a sub-header to show
              here — the month grid below already covers every day. */}
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
          // With no steps at all the period switch is noise — fall through
          // to the Generate card instead.
          <GenerateCard
            onGenerate={handleOpenDraftPreview}
            onAddManually={handleOpenAddSheet}
          />
        ) : (
          // Single active period (mockup-driven reversal of the img-03
          // accordion): only the segmented control's current selection
          // renders — no card chrome wraps the group list anymore, each
          // StepGroupHeader/RoutineProductCard sits directly in the scroll
          // content, matching the mock exactly.
          <>
            <NestableDraggableFlatList
              data={activeRenderGroups.groups}
              keyExtractor={(group) => group.action}
              renderItem={renderGroupItem(selectedPeriod, activeRenderGroups.groups)}
              onDragEnd={({ data }) => handleDragEndForPeriod(selectedPeriod, data)}
              activationDistance={12}
            />
            {renderExtraGroups(activeRenderGroups.groups, activeRenderGroups.extraGroups)}
            {!activeHasContent ? (
              <View style={styles.periodEmpty}>
                <Text style={styles.periodEmptyText}>
                  No steps for this {selectedPeriod === 'morning' ? 'morning' : 'evening'}.
                </Text>
                <Button variant="textActive" size="sm" onPress={handleOpenAddSheet}>
                  Add product
                </Button>
              </View>
            ) : null}
          </>
        )}

        {totalSteps > 0 ? (
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
            <OptimizeStrip
              hasFindings={validation?.hasBlockingFindings ?? false}
              onPress={handleOpenDraftPreview}
            />
          </View>
        ) : null}
      </NestableScrollContainer>
      )}

      <AddToRoutineSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        // Pre-selects whichever period the segmented control currently shows.
        activePeriod={selectedPeriod}
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

      {/* Edit-mode Schedule icon (SCREENS.md §7.3) — revives the previously
          dead RoutineSchedulerSheet rather than rebuilding the Mo–Su picker.
          Mounted only while a target is set (rather than always-mounted with
          `visible={false}`) — BottomSheet reads safe-area insets on mount, so
          this avoids requiring every RoutinesScreen host to wrap
          SafeAreaProvider just to render a sheet nobody opened. */}
      {schedulerTarget ? (
        <RoutineSchedulerSheet
          visible
          productId={schedulerTarget.productId}
          productType={schedulerTarget.productType}
          title="Edit Schedule"
          onClose={() => setSchedulerTarget(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

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
              {name} — {item.until ? `paused until ${item.until}` : reasonText(item.reasonCode)}
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

  listHeader: {
    marginBottom: space[4],
    gap: space[3],
  },

  // One rendered step GROUP: header, then its cards, then (if any) the
  // transition to the next group. gapSection carries the between-step
  // rhythm; the header's own gapInline sits inside StepGroupHeader's layout.
  groupWrap: {
    marginBottom: space.gapSection,
    gap: space.gapInline,
  },
  groupHeaderWrap: {
    marginBottom: space.gapInline,
  },

  // Gap between step mini-cards inside a period card; the last step's bottom
  // margin doubles as the card's inner bottom padding.
  stepRowWrap: {
    marginBottom: space.gapStack,
  },
  preCleanseReminderWrap: {
    marginTop: space[2],
  },

  // Non-card empty state for the selected period when it has no steps/gaps
  // of its own (the other period may still have content) — same copy/action
  // the old PeriodCard's collapsed-empty box used, without the card chrome
  // now that groups render directly in the scroll content.
  periodEmpty: {
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    gap: space[2],
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    marginBottom: space[3],
  },
  periodEmptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  addProductFooter: {
    paddingTop: space[4],
    paddingBottom: 40,
    gap: space[3],
  },
});
