import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DraggableFlatList, {
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import type { RenderItemParams } from 'react-native-draggable-flatlist';

import { ConflictWarningInline } from '@/components/routine/ConflictWarningInline';
import { WeeklySchedulePicker } from '@/components/routine/WeeklySchedulePicker';
import { SegmentedControl } from '@/components/ui/forms/SegmentedControl';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import type { Product, Routine, RoutineStep } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'morning' | 'evening';

interface StepRowProps {
  item: RoutineStep;
  drag: () => void;
  isActive: boolean;
  products: Product[];
  onUpdateSchedule: (stepId: string, days: number[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { PRODUCT_TYPE_LABELS } from '@/constants/labels';

const PERIOD_OPTIONS = [
  { value: 'morning', label: 'AM — Morning' },
  { value: 'evening', label: 'PM — Evening' },
];

// ─── Step row ─────────────────────────────────────────────────────────────────

function StepRow({ item, drag, isActive, products, onUpdateSchedule }: StepRowProps) {
  const product = item.productId
    ? products.find((p) => p.id === item.productId) ?? null
    : null;

  return (
    <View style={[rowStyles.container, isActive && rowStyles.active]}>
      {/* Drag handle */}
      <Pressable
        onLongPress={drag}
        style={rowStyles.handle}
        hitSlop={6}
        accessibilityLabel="Hold to reorder step"
        accessibilityRole="button"
      >
        <Feather name="menu" size={18} color={colors.textTertiary} />
      </Pressable>

      {/* Content */}
      <View style={rowStyles.content}>
        {product ? (
          <>
            <Text style={rowStyles.name} numberOfLines={1}>
              {product.name}
            </Text>
            {product.brand ? (
              <Text style={rowStyles.brand} numberOfLines={1}>
                {product.brand}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={rowStyles.emptyName}>
            {`Empty slot — ${PRODUCT_TYPE_LABELS[item.productType] ?? item.productType}`}
          </Text>
        )}

        <WeeklySchedulePicker
          scheduledDays={item.scheduledDays}
          onUpdate={(days) => onUpdateSchedule(item.id, days)}
        />
      </View>

      {/* Product type pill */}
      <View style={rowStyles.typePill}>
        <Text style={rowStyles.typeText}>
          {PRODUCT_TYPE_LABELS[item.productType] ?? item.productType}
        </Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[3] + 2,
    gap: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
    backgroundColor: colors.bgBase,
  },
  active: {
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.md,
    borderBottomWidth: 0,
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  handle: {
    paddingTop: 2,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  emptyName: {
    ...typography.body,
    color: colors.textTertiary,
  },
  brand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  typePill: {
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceSunken,
    alignSelf: 'flex-start',
    marginTop: 2,
    flexShrink: 0,
  },
  typeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function WeeklyEmptyState() {
  return (
    <View style={emptyStyles.wrap}>
      <Feather name="list" size={28} color={colors.textTertiary} />
      <Text style={emptyStyles.title}>No steps yet</Text>
      <Text style={emptyStyles.body}>
        Add products from the Catalog tab — they'll appear here as routine steps.
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: space[16],
    paddingHorizontal: space[8],
    gap: space[2],
  },
  title: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

// ─── Main view ────────────────────────────────────────────────────────────────

/**
 * Weekly Plan sub-view. Uses DraggableFlatList — must NOT be nested inside
 * another ScrollView. GestureHandlerRootView is provided by App.tsx.
 */
export function WeeklyPlanView() {
  const routines = useRoutinesStore((s) => s.routines);
  const updateRoutine = useRoutinesStore((s) => s.updateRoutine);
  const products = useProductsStore((s) => s.products);

  const [activePeriod, setActivePeriod] = useState<Period>('morning');

  const activeRoutine: Routine | undefined = routines.find(
    (r) => r.timeOfDay === activePeriod,
  );

  const visibleSteps = (activeRoutine?.steps ?? []).filter(
    (s) =>
      !s.hidden &&
      !(s.productId && products.find((p) => p.id === s.productId)?.isHidden),
  );
  const hiddenSteps = (activeRoutine?.steps ?? []).filter((s) => s.hidden);

  function handleDragEnd({ data }: { data: RoutineStep[] }) {
    if (!activeRoutine) return;
    // Preserve hidden steps at the end (HiddenStepsManager, Phase 5, will expose them)
    updateRoutine(activeRoutine.id, { steps: [...data, ...hiddenSteps] });
  }

  function handleUpdateSchedule(stepId: string, days: number[]) {
    if (!activeRoutine) return;
    const steps = activeRoutine.steps.map((s) =>
      s.id === stepId ? { ...s, scheduledDays: days } : s,
    );
    updateRoutine(activeRoutine.id, { steps });
  }

  function renderItem({ item, drag, isActive }: RenderItemParams<RoutineStep>) {
    return (
      <ScaleDecorator>
        <StepRow
          item={item}
          drag={drag}
          isActive={isActive}
          products={products}
          onUpdateSchedule={handleUpdateSchedule}
        />
      </ScaleDecorator>
    );
  }

  return (
    <View style={styles.container}>
      {/* AM/PM toggle */}
      <View style={styles.segmentWrap}>
        <SegmentedControl
          options={PERIOD_OPTIONS}
          value={activePeriod}
          onValueChange={(v) => setActivePeriod(v as Period)}
          fullWidth
        />
      </View>

      {/* Drag-and-drop step list */}
      <DraggableFlatList
        data={visibleSteps}
        keyExtractor={(item) => item.id}
        onDragEnd={handleDragEnd}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<WeeklyEmptyState />}
        ListFooterComponent={
          visibleSteps.length > 0 ? (
            <ConflictWarningInline routines={routines} products={products} />
          ) : null
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  segmentWrap: {
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
    backgroundColor: colors.bgBase,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: space[16],
  },
});
