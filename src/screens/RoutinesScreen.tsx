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
import { RehabNoticeCard } from '@/components/routine/RehabNoticeCard';
import { RoutineCalendarView } from '@/components/routine/RoutineCalendarView';
import { RemoveStepModal } from '@/components/routine/RemoveStepModal';
import { RoutineStepActionSheet } from '@/components/routine/RoutineStepActionSheet';
import { RoutineStepCard } from '@/components/routine/RoutineStepCard';
import { ContributionConsentMigrationBanner } from '@/components/routine/ContributionConsentMigrationBanner';
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
import { reclassifyMakeupRemover } from '@/utils/productForm/categoryDetector';
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
import { buildRehabNotices } from '@/utils/routineEngine/rehabFilter';
import type { ValidationResult } from '@/utils/routineEngine/validate';
import type { Product, RoutineStep } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = BottomTabScreenProps<RootTabParamList, 'Routines'>;
type Period = 'morning' | 'evening';

// ─── Period card colors (img-03 redesign) ──────────────────────────────────────
// Morning and evening each render as their own "dropdown card" faked from
// several adjacent, separately-rendered flat-list rows (header + steps)
// sharing one background color rather than one real nested View, since the
// drag-safety design requires a single flat list.
//
// The card's OUTLINE (top + both sides + bottom) is drawn entirely by a
// hairline border (PERIOD_CARD_BORDER_COLOR), applied per edge across the
// separate rows: top on the header, left/right on every row, bottom on the
// last element. A border doesn't blur or bleed, so it runs the full height
// continuously with no seams and no cropping — the one thing a shadow can't
// do here (a shadow only ever shows beside a view tall enough to cast it, so
// short header/cap shadows left the tall middle of the card unshadowed and
// looked cropped at top and bottom; per-row shadows instead bled onto
// neighbors as seams — both dead ends tried before this).
//
// A single soft drop shadow (PERIOD_CARD_SHADOW) is added at the card's
// BOTTOM edge ONLY, cast by whichever element is that true bottom edge:
// - collapsed / expanded-but-empty: the header (it IS the whole card), via
//   sectionStyles.shadowWrap applied only when isStandaloneCard;
// - expanded with steps: styles.cardClosingCap, a short end-cap rendered
//   AFTER the last step row (not wrapped around it — wrapping the tall row
//   haloed all four of its sides and read as "this one product is boxed").
// The shadow sits on an outer, background-less wrapper in both cases so iOS's
// rounded/filled-layer render on the inner colored view can't clip it (an
// earlier bare, childless 1px shadow view rendered unreliably — nothing for
// the native layer to compute a shadow shape from). Both paths cast the same
// PERIOD_CARD_SHADOW into the empty gap below, so the card reads identically
// open or closed, and there is no top or mid-side shadow to look cropped.
//
// No shadow ever touches an interior row or wraps a product card — those get
// only their own light gray outline (RoutineStepCard's `card` style).
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
// A shadow can only ever appear beside a view tall enough to cast it — the
// header and the closing cap are both short, so their shadows only bleed
// sideways across their own (short) height, leaving the middle of a tall,
// multi-row card with no visible side shadow at all ("cropped" at the top
// and bottom, missing in the middle). A hairline border has no such
// limitation — it doesn't blur or bleed, so it can run the FULL height,
// continuously, across every separately-rendered row. Left/right only (top
// and bottom already read fine from the shadow) on sectionStyles.wrap,
// styles.cardWrapper, and styles.cardClosingCapInner.
const PERIOD_CARD_BORDER_COLOR = 'rgba(9, 9, 11, 0.08)';
// `elevation: 0` is deliberate: Android's elevation reorders siblings by
// value rather than paint order, which would let this shadow's layer draw
// over a neighboring row and reproduce the exact seam bug this file already
// fixed once — better to have no shadow on Android here than a broken one.
//
// The offset height (5) is >= the blur radius (4) ON PURPOSE — this makes the
// shadow strictly DOWNWARD: the blur around the caster's top edge is centered
// 5px down with a 4px radius, so it spans y∈[1,9] and never reaches above the
// top edge (y=0). Without that, the blur haloed ~1px upward onto the white
// card sitting above the closing cap, showing as a faint shadow strip over
// the white. Everything above the caster's bottom edge is hidden behind the
// caster's own opaque body, so only the true bottom shadow, in the gap below
// the card, is ever visible.
const PERIOD_CARD_SHADOW = {
  shadowColor: palette.black,
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.13,
  shadowRadius: 4,
  elevation: 0,
} as const;

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
  const dismissedBanners = useSettingsStore((s) => s.dismissedBanners);
  const dismissBanner = useSettingsStore((s) => s.dismissBanner);
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

      // Last step of its period rounds the card's bottom corners and adds
      // the gap before the next period's card.
      const index = getIndex();
      const nextRow = typeof index === 'number' ? rows[index + 1] : undefined;
      const isLastInPeriod = !nextRow || nextRow.kind === 'section';

      return (
        <ScaleDecorator>
          <View>
            <View
              style={[
                styles.cardWrapper,
                { backgroundColor: PERIOD_CARD_BG },
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
            {/* A short end-cap, not a wrapper around the whole row — wrapping
                the entire (tall) product row in a shadow box makes the blur
                radiate around all four sides of THAT row, reading as "this
                one product card is boxed" rather than "the group ends here".
                The cap's own height is small, so its shadow only haloes a
                thin band, not the row's full height. Split the same way as
                the header: an outer view with only the shadow, wrapping an
                inner view with the real background + rounded corners — a
                shadow cast by a fully empty, backgroundless view renders
                unreliably on iOS (nothing for the native layer to compute a
                shadow shape from), which is why an earlier version of this
                cap (transparent, 1px, no children) looked cropped. */}
            {isLastInPeriod ? (
              <View style={styles.cardClosingCap}>
                <View style={styles.cardClosingCapInner} />
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
        {rehabNotices.map((notice) => (
          <RehabNoticeCard key={notice.key} notice={notice} />
        ))}
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
        {profile?.contributionConsent?.timestamp === null &&
          !(dismissedBanners ?? []).includes('contribution_consent_migration') && (
            <ContributionConsentMigrationBanner
              onGoToSettings={() => navigation.navigate('Profile' as never)}
              onDismiss={() => dismissBanner('contribution_consent_migration')}
            />
          )}
        <SeasonalNoticeBanner />
        <DuplicateSlotWarningInline
          routines={routines}
          products={products}
          onPressGroup={handlePressDuplicateGroup}
        />
      </View>
    ),
    [
      viewMode,
      selectedDow,
      handleDaySelect,
      rehabNotices,
      routines,
      products,
      handlePressDuplicateGroup,
      profile,
      updateProfile,
      navigation,
      dismissedBanners,
      dismissBanner,
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
    // Shadow lives on this OUTER view, and ONLY when this header is the card's
    // true bottom edge (collapsed, or expanded-but-empty) — a bottom-only
    // shadow cast into the empty gap below renders cleanly with no seam. When
    // expanded with steps, the header is only the TOP of the card, so it casts
    // no shadow (the closing cap does); the sides/top are drawn by the border
    // instead, which — unlike a shadow — runs the full height with no cropping.
    // The shadow sits on this outer view (no bg/radius of its own) so iOS's
    // rounded/filled-layer render on the inner view can't clip it.
    <View style={[isStandaloneCard && sectionStyles.shadowWrap, isStandaloneCard && sectionStyles.cardGap]}>
      <View
        style={[
          sectionStyles.wrap,
          { backgroundColor: PERIOD_CARD_BG },
          sectionStyles.roundTop,
          isStandaloneCard && sectionStyles.roundBottom,
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
            <View style={[sectionStyles.periodIconCircle, { backgroundColor: PERIOD_ICON_BG[period] }]}>
              <Feather
                name={period === 'morning' ? 'sun' : 'moon'}
                size={14}
                color={PERIOD_ICON_COLOR[period]}
              />
            </View>
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
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  // Shadow only — no backgroundColor/borderRadius of its own, so it has
  // nothing to clip the shadow it casts (see the render-time comment above).
  shadowWrap: {
    ...PERIOD_CARD_SHADOW,
  },
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
  // Rounds AND closes the bottom when this header is the whole card (see
  // isStandaloneCard) — otherwise a step row + cap below apply it instead.
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

  // Shared background (set inline via PERIOD_CARD_BG) continues the period
  // card's color behind each step — the gap between product cards reads as a
  // colored gutter rather than a break in the card. The last step's own
  // bottom stays square; cardClosingCap (below) supplies the rounded corners,
  // the closing shadow, and the gap to the next period, all in one place.
  cardWrapper: {
    paddingHorizontal: space[3],
    paddingBottom: space[3],
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: PERIOD_CARD_BORDER_COLOR,
  },
  // Outer: shadow only, no background — same reasoning as sectionStyles.
  // shadowWrap. Short on purpose: a shadow this tall only haloes a thin
  // band, not the whole (tall) product row above it.
  cardClosingCap: {
    height: 12,
    marginBottom: space[4],
    ...PERIOD_CARD_SHADOW,
  },
  // Inner: real background + the rounded corners — gives the outer view's
  // shadow an actual opaque layer to compute from, unlike a bare transparent
  // View, and visually reads as the same white card simply continuing down
  // a little further before curving to a close.
  cardClosingCapInner: {
    flex: 1,
    backgroundColor: PERIOD_CARD_BG,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: PERIOD_CARD_BORDER_COLOR,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
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
