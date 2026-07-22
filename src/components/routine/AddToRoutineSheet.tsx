import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { Button } from '@/components/ui/core/Button';
import { FilterChip } from '@/components/ui/core/FilterChip';
import { IconButton } from '@/components/ui/core/IconButton';
import { Input } from '@/components/ui/forms/Input';
import { DuplicateSlotChoiceSheet } from '@/components/routine/DuplicateSlotChoiceSheet';
import { ProductPickerCard } from '@/components/routine/ProductPickerCard';
import { WeeklySchedulePicker } from '@/components/routine/WeeklySchedulePicker';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { deriveProductSchedule } from '@/utils/routineLabel';
import { getSlotCategoryLabel } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { Product, ProductType, RoutineStep } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddToRoutineSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-selects the time-of-day toggle in Step 2. Defaults to 'morning'. */
  activePeriod?: 'morning' | 'evening';
}

type Step = 'pick' | 'schedule';

type CategoryKey = 'All' | 'Serums' | 'Moisturizers' | 'Cleansers' | 'SPF' | 'Soothing' | 'Treatments';

const CATEGORIES: CategoryKey[] = [
  'All',
  'Serums',
  'Moisturizers',
  'Cleansers',
  'SPF',
  'Soothing',
  'Treatments',
];

const CATEGORY_TYPES: Record<CategoryKey, ProductType[] | null> = {
  All: null,
  Serums: ['serum', 'ampoule', 'essence', 'toner'],
  Moisturizers: ['moisturizer', 'cream', 'lotion', 'gel'],
  Cleansers: ['cleanser', 'makeup_remover'],
  SPF: ['spf'],
  Soothing: ['mask', 'balm'],
  Treatments: ['spot_treatment', 'peeling'],
};

const SNAP_POINTS = ['92%'];

// ─── Component ────────────────────────────────────────────────────────────────

export function AddToRoutineSheet({
  visible,
  onClose,
  activePeriod = 'morning',
}: AddToRoutineSheetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('All');
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const wasPresented = useRef(false);

  const [step, setStep] = useState<Step>('pick');
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  const [morning, setMorning] = useState(false);
  const [evening, setEvening] = useState(false);
  const [scheduledDays, setScheduledDays] = useState<number[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Story 1 (routine-similar-product-priority): the period currently showing
  // a same-slot choice sheet, and the remaining checked periods still queued
  // behind it. AM resolves before PM when both are checked (tech design
  // Assumption — resolved one period at a time).
  const [duplicateConflict, setDuplicateConflict] = useState<{
    routineId: string;
    existingStep: RoutineStep;
  } | null>(null);
  const [remainingQueue, setRemainingQueue] = useState<Array<{ routineId: string }>>([]);

  const products = useProductsStore((s) => s.products);
  const upsertProductStep = useRoutinesStore((s) => s.upsertProductStep);

  // Sync the imperative sheet to the declarative `visible` prop. Calling
  // `.dismiss()` before the sheet has ever been `.present()`-ed corrupts
  // @gorhom/bottom-sheet's internal modal-stack bookkeeping (it calls
  // willUnmountSheet before mountSheet was ever registered), which then
  // sabotages the *next* present() — so only dismiss after a real present.
  useEffect(() => {
    if (visible) {
      wasPresented.current = true;
      sheetRef.current?.present();
    } else if (wasPresented.current) {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSelectedCategory('All');
      setStep('pick');
      setPendingProduct(null);
      setMorning(false);
      setEvening(false);
      setScheduledDays([]);
      setValidationError(null);
      setDuplicateConflict(null);
      setRemainingQueue([]);
    }
  }, [visible]);

  function handleProductSelect(product: Product) {
    const existing = deriveProductSchedule(
      useRoutinesStore.getState().routines,
      product.id,
    );
    const isNew = !existing.morning && !existing.evening;
    setPendingProduct(product);
    setMorning(isNew ? activePeriod === 'morning' : existing.morning);
    setEvening(isNew ? activePeriod === 'evening' : existing.evening);
    setScheduledDays(existing.scheduledDays);
    setValidationError(null);
    setStep('schedule');
  }

  function handleBack() {
    setStep('pick');
    setPendingProduct(null);
    setValidationError(null);
  }

  // Story 1: walks the checked-period queue one at a time. A same-slot
  // conflict pauses the walk (opens the choice sheet) and waits for the
  // user's decision; a conflict-free period commits immediately, exactly
  // like today's upsert-only behavior, then moves on.
  function runQueue(queue: Array<{ routineId: string }>) {
    if (!pendingProduct) return;
    if (queue.length === 0) {
      onClose();
      return;
    }
    const [current, ...rest] = queue;
    const conflict = useRoutinesStore
      .getState()
      .findSameSlotConflict(current.routineId, pendingProduct.productType, pendingProduct.id);

    if (conflict) {
      setDuplicateConflict({ routineId: current.routineId, existingStep: conflict });
      setRemainingQueue(rest);
      return;
    }

    upsertProductStep(current.routineId, pendingProduct.id, pendingProduct.productType, scheduledDays);
    runQueue(rest);
  }

  function handleSave() {
    if (!pendingProduct) return;
    if (!morning && !evening) {
      setValidationError('Please select when you will be using this product (Morning, Evening, or Both)');
      return;
    }

    const { routines } = useRoutinesStore.getState();
    const morningRoutine = routines.find((r) => r.timeOfDay === 'morning');
    const eveningRoutine = routines.find((r) => r.timeOfDay === 'evening');

    const queue: Array<{ routineId: string }> = [];
    if (morning && morningRoutine) queue.push({ routineId: morningRoutine.id });
    if (evening && eveningRoutine) queue.push({ routineId: eveningRoutine.id });

    // In normal operation DEFAULT_ROUTINES are always seeded on first launch.
    // This guard fires only if the store was cleared or corrupted.
    if (queue.length === 0) {
      setValidationError('Could not save — routines not available. Please restart the app.');
      return;
    }

    runQueue(queue);
  }

  function handleReplaceDuplicate() {
    if (!duplicateConflict || !pendingProduct || !duplicateConflict.existingStep.productId) return;
    useRoutinesStore
      .getState()
      .replaceProductStep(
        duplicateConflict.routineId,
        duplicateConflict.existingStep.productId,
        { id: pendingProduct.id, productType: pendingProduct.productType },
        scheduledDays,
      );
    const rest = remainingQueue;
    setDuplicateConflict(null);
    setRemainingQueue([]);
    runQueue(rest);
  }

  function handleKeepBothDuplicate() {
    if (!duplicateConflict || !pendingProduct) return;
    upsertProductStep(duplicateConflict.routineId, pendingProduct.id, pendingProduct.productType, scheduledDays);
    const rest = remainingQueue;
    setDuplicateConflict(null);
    setRemainingQueue([]);
    runQueue(rest);
  }

  // AC4: cancelling aborts the WHOLE save — the rest of the queue never runs,
  // and the routine is unchanged for every period, not just the current one.
  function handleCancelDuplicate() {
    setDuplicateConflict(null);
    setRemainingQueue([]);
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const types = CATEGORY_TYPES[selectedCategory];
    return products.filter((p) => {
      if (p.isHidden) return false;
      if (types && !types.includes(p.productType)) return false;
      if (q) {
        const inName = p.name.toLowerCase().includes(q);
        const inBrand = p.brand?.toLowerCase().includes(q) ?? false;
        if (!inName && !inBrand) return false;
      }
      return true;
    });
  }, [products, searchQuery, selectedCategory]);

  // Tapping the backdrop should only dismiss on step 1 — step 2 has
  // unsaved schedule state, same as the old dismissOnBackdrop behavior.
  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...backdropProps}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior={step === 'pick' ? 'close' : 'none'}
        opacity={0.45}
      />
    ),
    [step],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      onDismiss={onClose}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      backdropComponent={renderBackdrop}
    >
      {step === 'pick' ? (
        <StepPick
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          filtered={filtered}
          onProductSelect={handleProductSelect}
          onClose={onClose}
          insets={insets}
        />
      ) : (
        <StepSchedule
          pendingProduct={pendingProduct!}
          morning={morning}
          onMorningChange={(v) => { setMorning(v); setValidationError(null); }}
          evening={evening}
          onEveningChange={(v) => { setEvening(v); setValidationError(null); }}
          scheduledDays={scheduledDays}
          onScheduledDaysChange={setScheduledDays}
          validationError={validationError}
          onBack={handleBack}
          onSave={handleSave}
          insets={insets}
        />
      )}

      {pendingProduct ? (
        <DuplicateSlotChoiceSheet
          visible={duplicateConflict !== null}
          slotLabel={getSlotCategoryLabel(pendingProduct.productType)}
          existingProduct={
            (duplicateConflict &&
              products.find((p) => p.id === duplicateConflict.existingStep.productId)) ||
            pendingProduct
          }
          incomingProduct={pendingProduct}
          onReplace={handleReplaceDuplicate}
          onKeepBoth={handleKeepBothDuplicate}
          onCancel={handleCancelDuplicate}
        />
      ) : null}
    </BottomSheetModal>
  );
}

// ─── Step 1: Pick a product ───────────────────────────────────────────────────

interface StepPickProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: CategoryKey;
  onCategoryChange: (c: CategoryKey) => void;
  filtered: Product[];
  onProductSelect: (product: Product) => void;
  onClose: () => void;
  insets: EdgeInsets;
}

function StepPick({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  filtered,
  onProductSelect,
  onClose,
  insets,
}: StepPickProps) {
  return (
    <>
      {/* Fixed header — plain View keeps it in normal flex flow above the FlatList */}
      <View style={styles.fixedHeader}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Add to routine</Text>
          </View>
          <IconButton
            icon={<Feather name="x" size={18} color={colors.textSecondary} />}
            label="Close"
            variant="secondary"
            size="sm"
            onPress={onClose}
          />
        </View>

        <View style={styles.searchSection}>
          <Input
            icon={<Feather name="search" size={16} color={colors.textTertiary} />}
            placeholder="Search by name, brand or ingredient"
            value={searchQuery}
            onChangeText={onSearchChange}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersRow}
        >
          {CATEGORIES.map((cat) => (
            <FilterChip
              key={cat}
              selected={cat === selectedCategory}
              onPress={() => onCategoryChange(cat)}
              accessibilityLabel={cat === 'All' ? 'Show all products' : `Filter by ${cat}`}
              style={styles.filterChipItem}
            >
              {cat}
            </FilterChip>
          ))}
        </ScrollView>
      </View>

      <BottomSheetFlatList
        data={filtered}
        keyExtractor={(product) => product.id}
        renderItem={({ item }) => (
          <ProductPickerCard product={item} onAdd={onProductSelect} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
        style={styles.productList}
        contentContainerStyle={[
          styles.productListContent,
          { paddingBottom: insets.bottom + space[4] },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </>
  );
}

// ─── Step 2: Configure schedule ───────────────────────────────────────────────

interface StepScheduleProps {
  pendingProduct: Product;
  morning: boolean;
  onMorningChange: (v: boolean) => void;
  evening: boolean;
  onEveningChange: (v: boolean) => void;
  scheduledDays: number[];
  onScheduledDaysChange: (days: number[]) => void;
  validationError: string | null;
  onBack: () => void;
  onSave: () => void;
  insets: EdgeInsets;
}

function StepSchedule({
  pendingProduct,
  morning,
  onMorningChange,
  evening,
  onEveningChange,
  scheduledDays,
  onScheduledDaysChange,
  validationError,
  onBack,
  onSave,
  insets,
}: StepScheduleProps) {
  return (
    <>
      <View style={styles.header}>
        <IconButton
          icon={<Feather name="arrow-left" size={18} color={colors.textSecondary} />}
          label="Back to product list"
          variant="secondary"
          size="sm"
          onPress={onBack}
        />
        <View style={[styles.headerText, styles.headerTextIndented]}>
          <Text style={styles.title} numberOfLines={1}>
            {pendingProduct.name}
          </Text>
          <Text style={styles.subtitle}>Choose when to use this product</Text>
        </View>
      </View>

      <BottomSheetScrollView
        style={styles.scheduleBody}
        contentContainerStyle={styles.scheduleBodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Time of Day</Text>
          <View style={styles.chipRow}>
            <TimeChip
              icon="sun"
              label="Morning"
              active={morning}
              onPress={() => onMorningChange(!morning)}
            />
            <TimeChip
              icon="moon"
              label="Evening"
              active={evening}
              onPress={() => onEveningChange(!evening)}
            />
          </View>
        </View>

        {validationError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{validationError}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Weekly Planner</Text>
          <WeeklySchedulePicker scheduledDays={scheduledDays} onUpdate={onScheduledDaysChange} />
        </View>
      </BottomSheetScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space[2] }]}>
        <Button variant="secondary" size="lg" onPress={onBack} style={styles.actionBtn}>
          Back
        </Button>
        <Button size="lg" onPress={onSave} style={styles.actionBtn}>
          Add to routine
        </Button>
      </View>
    </>
  );
}

// ─── Time chip ────────────────────────────────────────────────────────────────

function TimeChip({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.timeChip, active && styles.timeChipActive]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
    >
      <Feather
        name={icon}
        size={15}
        color={active ? palette.white : colors.textSecondary}
      />
      <Text style={[styles.timeChipLabel, active && styles.timeChipLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
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
    width: 36,
    height: 4,
  },

  // ── Shared header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingBottom: space[4],
  },
  headerText: {
    flex: 1,
    gap: space[1],
  },
  headerTextIndented: {
    marginLeft: space[3],
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // ── Step 1: fixed header block
  fixedHeader: {
    backgroundColor: colors.bgBase,
  },
  searchSection: {
    paddingHorizontal: space[4],
    paddingBottom: space[3],
  },
  filtersScroll: {},
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    gap: space[3],
  },
  filterChipItem: {
    flexShrink: 0,
  },

  // ── Step 1: product list — BottomSheetFlatList only, no extra wrappers
  productList: {
    flex: 1,
  },
  productListContent: {
    gap: space[3],
    paddingHorizontal: space[4],
    paddingTop: space[3],
  },
  empty: {
    alignItems: 'center',
    paddingVertical: space[8],
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },

  // ── Step 2: schedule
  scheduleBody: {
    flex: 1,
  },
  scheduleBodyContent: {
    paddingHorizontal: space[4],
    paddingTop: space[3],
  },
  section: {
    gap: space[2],
    marginBottom: space[5],
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  timeChip: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  timeChipActive: {
    backgroundColor: palette.black,
    borderColor: palette.black,
  },
  timeChipLabel: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
  timeChipLabelActive: {
    color: palette.white,
  },
  errorBanner: {
    backgroundColor: colors.statusErrorTint,
    borderRadius: radius.sm,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderLeftWidth: 3,
    borderLeftColor: colors.statusError,
    marginBottom: space[5],
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.statusError,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingTop: space[4],
  },
  actionBtn: {
    flex: 1,
  },
});
