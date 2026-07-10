import React, { useCallback, useMemo, useState } from 'react';
import {
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
import { GenerateCard } from '@/components/routine/GenerateCard';
import { OptimizeStrip } from '@/components/routine/OptimizeStrip';
import { PlannerBlock } from '@/components/routine/PlannerBlock';
import { RehabWidget } from '@/components/routine/RehabWidget';
import { RemoveStepModal } from '@/components/routine/RemoveStepModal';
import { RoutineStepCard } from '@/components/routine/RoutineStepCard';
import { SeasonalNoticeBanner } from '@/components/routine/SeasonalNoticeBanner';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { RootTabParamList } from '@/navigation/AppNavigator';
import {
  applyRoutinePlan,
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
import { getAdaptationStatus } from '@/utils/routineEngine/adaptation';
import { getDailyView, type FrozenStepView } from '@/utils/routineEngine/dailyView';
import { buildProductFacts } from '@/utils/routineEngine/productFacts';
import { buildRehabWidgetState } from '@/utils/routineEngine/rehabFilter';
import type { ValidationResult } from '@/utils/routineEngine/validate';
import type { Product, RoutineStep } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = BottomTabScreenProps<RootTabParamList, 'Routines'>;
type Period = 'morning' | 'evening';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isStepForDay(step: RoutineStep, dow: number): boolean {
  const days = step.scheduledDays ?? [];
  return days.length === 0 || days.includes(dow);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RoutinesScreen({ navigation }: Props) {
  const products = useProductsStore((s) => s.products);
  const routines = useRoutinesStore((s) => s.routines);
  const procedures = useProceduresStore((s) => s.procedures);
  const profile = useProfileStore((s) => s.profile);
  const cycleType = useSettingsStore((s) => s.routineCycleType);
  const applicationStats = useTrackingStore((s) => s.applicationStats);
  const reorderSteps = useRoutinesStore((s) => s.reorderSteps);
  const removeStepFromDay = useRoutinesStore((s) => s.removeStepFromDay);
  const removeProductStep = useRoutinesStore((s) => s.removeProductStep);

  const [activePeriod, setActivePeriod] = useState<Period>('morning');
  const [selectedDow, setSelectedDow] = useState<number>(() => new Date().getDay());
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{ stepId: string; productId: string; productName: string } | null>(null);
  // Draft Preview state — a generated plan lives only here until committed
  const [draft, setDraft] = useState<ValidationResult | null>(null);

  // Restore today's day and exit edit mode when the screen gains focus.
  useFocusEffect(
    useCallback(() => {
      setSelectedDow(new Date().getDay());
      setIsEditMode(false);
    }, []),
  );

  const handlePeriodChange = useCallback((p: Period) => {
    setActivePeriod(p);
    setIsEditMode(false);
  }, []);

  const handleDaySelect = useCallback((dow: number) => {
    setSelectedDow(dow);
    setIsEditMode(false);
  }, []);

  // Single shared entry point for both the header "+" and the in-content
  // "Add product" button — both must open the exact same flow.
  // Always exits edit mode first so the sheet opens in a clean state.
  const handleOpenAddSheet = useCallback(() => {
    setIsEditMode(false);
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
    setIsEditMode(false);
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

  const activeRoutine = activePeriod === 'morning' ? morningRoutine : eveningRoutine;
  const activeSteps = activePeriod === 'morning' ? amSteps : pmSteps;

  function handleDragEnd(reorderedVisible: RoutineStep[]) {
    if (!isEditMode || !activeRoutine) return;
    const visibleSet = new Set(reorderedVisible.map((s) => s.id));
    const result: RoutineStep[] = [];
    let idx = 0;
    for (const step of activeRoutine.steps) {
      result.push(visibleSet.has(step.id) ? reorderedVisible[idx++] : step);
    }
    if (idx !== reorderedVisible.length) return;
    reorderSteps(activeRoutine.id, result);
  }

  const renderItem = useCallback(
    ({ item, drag, isActive: _isActive }: RenderItemParams<RoutineStep>) => {
      const product = item.productId
        ? products.find((p) => p.id === item.productId) ?? null
        : null;

      if (!product) return null;

      return (
        <ScaleDecorator>
          <View style={styles.cardWrapper}>
            <RoutineStepCard
              product={product}
              onCardPress={
                isEditMode
                  ? undefined
                  : () =>
                      navigation.navigate('My Shelf', {
                        screen: 'ProductDetail',
                        params: { productId: product.id },
                      })
              }
              conflictingProductName={conflictMap.get(item.id) ?? null}
              adaptationWeek={adaptationWeeks.get(product.id) ?? null}
              drag={drag}
              isEditMode={isEditMode}
              onDelete={
                isEditMode && activeRoutine
                  ? () =>
                      setPendingRemoval({
                        stepId: item.id,
                        productId: product.id,
                        productName: product.name,
                      })
                  : undefined
              }
            />
          </View>
        </ScaleDecorator>
      );
    },
    [isEditMode, activeRoutine, conflictMap, adaptationWeeks, products, navigation],
  );

  const activeFrozen = activeRoutine ? frozenRows.get(activeRoutine.id) ?? [] : [];

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        {/* Rehab shield anchors at the very top while a rehab window is live
            (research §1.5 V3); the blocks below render null when idle */}
        <RehabWidget state={rehabState} />
        <SeasonalNoticeBanner />
        <ClinicalRestrictionsBlock />
        <PlannerBlock
          activePeriod={activePeriod}
          onPeriodChange={handlePeriodChange}
          selectedDow={selectedDow}
          onDaySelect={handleDaySelect}
        />
      </View>
    ),
    [activePeriod, selectedDow, handlePeriodChange, handleDaySelect, rehabState],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Routines"
        rightAction={
          <View style={styles.headerActions}>
            {!isEditMode ? (
              <IconButton
                icon={<Feather name="plus" size={18} color={palette.bottleGreen} />}
                label="Add product to routine"
                variant="ghost"
                size="sm"
                round
                onPress={handleOpenAddSheet}
              />
            ) : null}
            <IconButton
              icon={
                <Feather
                  name={isEditMode ? 'check' : 'edit-2'}
                  size={18}
                  color={palette.bottleGreen}
                />
              }
              label={isEditMode ? 'Done editing' : 'Edit routine'}
              variant="ghost"
              size="sm"
              round
              onPress={() => setIsEditMode((prev) => !prev)}
            />
          </View>
        }
      />
      <DraggableFlatList
        data={activeSteps}
        keyExtractor={(item) => item.id}
        onDragEnd={({ data }) => handleDragEnd(data)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          !isEditMode ? (
            <View style={styles.addProductFooter}>
              <PausedSteps frozen={activeFrozen} products={products} />
              <Button
                variant="textActive"
                size="md"
                fullWidth
                icon={<Feather name="plus" size={16} color={palette.bottleGreen} />}
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
          ) : null
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

      <AddToRoutineSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        activePeriod={activePeriod}
      />

      <DraftPreviewSheet
        visible={draft !== null}
        onClose={() => setDraft(null)}
        plan={draft?.proposedPlan ?? null}
        diff={draft?.diff ?? []}
        onCommit={handleCommitDraft}
      />

      <RemoveStepModal
        visible={pendingRemoval !== null}
        productName={pendingRemoval?.productName ?? ''}
        dow={selectedDow}
        onRemoveDay={() => {
          if (activeRoutine && pendingRemoval) {
            removeStepFromDay(activeRoutine.id, pendingRemoval.stepId, selectedDow);
          }
          setPendingRemoval(null);
        }}
        onRemoveAll={() => {
          if (activeRoutine && pendingRemoval) {
            removeProductStep(activeRoutine.id, pendingRemoval.productId);
          }
          setPendingRemoval(null);
        }}
        onCancel={() => setPendingRemoval(null)}
      />
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
    backgroundColor: colors.bgSubtle,
  },

  listContent: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[6],
    paddingBottom: space[4],
  },

  listHeader: {
    marginBottom: space[4],
    gap: space[3],
  },

  cardWrapper: {
    marginBottom: space[3],
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
