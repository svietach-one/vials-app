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
import { PlannerBlock } from '@/components/routine/PlannerBlock';
import { RoutineStepCard } from '@/components/routine/RoutineStepCard';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { RootTabParamList } from '@/navigation/AppNavigator';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { ConflictEngine } from '@/utils/conflictEngine';
import type { RoutineStep } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = BottomTabScreenProps<RootTabParamList, 'Routine Hub'>;
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
  const reorderSteps = useRoutinesStore((s) => s.reorderSteps);
  const removeStepFromDay = useRoutinesStore((s) => s.removeStepFromDay);

  const [activePeriod, setActivePeriod] = useState<Period>('morning');
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [selectedDow, setSelectedDow] = useState<number>(() => new Date().getDay());
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

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

  const morningRoutine = routines.find((r) => r.timeOfDay === 'morning');
  const eveningRoutine = routines.find((r) => r.timeOfDay === 'evening');

  const { amSteps, pmSteps, conflictMap } = useMemo(() => {
    const isVisible = (s: RoutineStep) =>
      !s.hidden &&
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
  }, [routines, products, selectedDow]);

  const activeRoutine = activePeriod === 'morning' ? morningRoutine : eveningRoutine;
  const activeSteps = activePeriod === 'morning' ? amSteps : pmSteps;

  // Date label for the AddToRoutineSheet subtitle — derived from the selected day, not today.
  const sheetDateLabel = useMemo(() => {
    const today = new Date();
    const d = new Date(today);
    d.setDate(today.getDate() + (selectedDow - today.getDay()));
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  }, [selectedDow]);

  function toggleComplete(stepId: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }

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
              checked={completed.has(item.id)}
              onToggle={() => toggleComplete(item.id)}
              onCardPress={
                isEditMode
                  ? undefined
                  : () =>
                      navigation.navigate('Vials', {
                        screen: 'ProductDetail',
                        params: { productId: product.id },
                      })
              }
              conflictingProductName={conflictMap.get(item.id) ?? null}
              drag={drag}
              isEditMode={isEditMode}
              onDelete={
                isEditMode && activeRoutine
                  ? () => removeStepFromDay(activeRoutine.id, item.id, selectedDow)
                  : undefined
              }
            />
          </View>
        </ScaleDecorator>
      );
    },
    [isEditMode, activeRoutine, selectedDow, completed, conflictMap, products, navigation, removeStepFromDay],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <PlannerBlock
          activePeriod={activePeriod}
          onPeriodChange={handlePeriodChange}
          selectedDow={selectedDow}
          onDaySelect={handleDaySelect}
        />
      </View>
    ),
    [activePeriod, selectedDow, handlePeriodChange, handleDaySelect],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Routine"
        rightAction={
          <Button
            variant="textActive"
            size="sm"
            onPress={() => setIsEditMode((prev) => !prev)}
            accessibilityLabel={isEditMode ? 'Done editing' : 'Edit routine'}
          >
            {isEditMode ? 'Done' : 'Edit'}
          </Button>
        }
      />
      <DraggableFlatList
        data={activeSteps}
        keyExtractor={(item) => item.id}
        onDragEnd={({ data }) => handleDragEnd(data)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<EmptyRoutine />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Fixed bottom: Add product button */}
      <View style={styles.bottomBar}>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
          onPress={() => setAddSheetVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add product to routine"
        >
          <Feather name="sun" size={16} color={palette.black} />
          <Text style={styles.addBtnText}>Add product</Text>
        </Pressable>
      </View>

      <AddToRoutineSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        dateLabel={sheetDateLabel}
        activePeriod={activePeriod}
      />
    </SafeAreaView>
  );
}

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
    backgroundColor: palette.zinc100,
  },

  listContent: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[6],
    paddingBottom: space[4],
  },

  listHeader: {
    marginBottom: space[4],
  },

  cardWrapper: {
    marginBottom: space[3],
  },

  bottomBar: {
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
    backgroundColor: palette.white,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingVertical: space[4],
    borderWidth: 1.5,
    borderColor: palette.black,
    borderRadius: radius.lg,
    backgroundColor: palette.white,
  },
  addBtnPressed: {
    backgroundColor: palette.zinc50,
  },
  addBtnText: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: palette.black,
  },
});
