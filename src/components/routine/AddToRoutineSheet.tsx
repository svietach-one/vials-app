import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { BottomSheet } from '@/components/ui/core/BottomSheet';
import { Button } from '@/components/ui/core/Button';
import { FilterChip } from '@/components/ui/core/FilterChip';
import { Input } from '@/components/ui/forms/Input';
import { ProductPickerCard } from '@/components/routine/ProductPickerCard';
import { WeeklySchedulePicker } from '@/components/routine/WeeklySchedulePicker';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { Product, ProductType } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddToRoutineSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-selects the time-of-day toggle in Step 2. Defaults to 'morning'. */
  activePeriod?: 'morning' | 'evening';
  /** e.g. "Saturday, 27 Jun" — shown as subtitle in Step 1. */
  dateLabel?: string;
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

// ─── Component ────────────────────────────────────────────────────────────────

export function AddToRoutineSheet({
  visible,
  onClose,
  activePeriod = 'morning',
  dateLabel,
}: AddToRoutineSheetProps) {
  // Step 1: product picking
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('All');

  // Multi-step flow
  const [step, setStep] = useState<Step>('pick');
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  // Step 2: schedule configuration
  const [morning, setMorning] = useState(false);
  const [evening, setEvening] = useState(false);
  const [scheduledDays, setScheduledDays] = useState<number[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const products = useProductsStore((s) => s.products);
  const upsertProductStep = useRoutinesStore((s) => s.upsertProductStep);

  // Reset all state when sheet closes
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
    }
  }, [visible]);

  function handleProductSelect(product: Product) {
    setPendingProduct(product);
    setMorning(activePeriod === 'morning');
    setEvening(activePeriod === 'evening');
    setScheduledDays([]);
    setValidationError(null);
    setStep('schedule');
  }

  function handleBack() {
    setStep('pick');
    setPendingProduct(null);
    setValidationError(null);
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

    if (morning && morningRoutine) {
      upsertProductStep(morningRoutine.id, pendingProduct.id, pendingProduct.productType, scheduledDays);
    }
    if (evening && eveningRoutine) {
      upsertProductStep(eveningRoutine.id, pendingProduct.id, pendingProduct.productType, scheduledDays);
    }

    onClose();
  }

  const resolvedDate = dateLabel ?? new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

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

  return (
    <BottomSheet visible={visible} onClose={onClose} dismissOnBackdrop={step === 'pick'}>
      {step === 'pick' ? (
        <>
          {/* ── Step 1: Header ─────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Add to routine</Text>
              <Text style={styles.subtitle}>{resolvedDate}</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* ── Step 1: Search ─────────────────────────────────────────────── */}
          <View style={styles.searchSection}>
            <Input
              icon={<Feather name="search" size={16} color={colors.textTertiary} />}
              placeholder="Search by name, brand or ingredient"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {/* ── Step 1: Category filters ────────────────────────────────────── */}
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
                onPress={() => setSelectedCategory(cat)}
                accessibilityLabel={cat === 'All' ? 'Show all products' : `Filter by ${cat}`}
              >
                {cat}
              </FilterChip>
            ))}
          </ScrollView>

          {/* ── Step 1: Product list ───────────────────────────────────────── */}
          <ScrollView
            style={styles.productList}
            contentContainerStyle={styles.productListContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {filtered.map((product) => (
              <ProductPickerCard
                key={product.id}
                product={product}
                onAdd={handleProductSelect}
              />
            ))}
            {filtered.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No products found</Text>
              </View>
            )}
          </ScrollView>
        </>
      ) : (
        <>
          {/* ── Step 2: Header with back button ────────────────────────────── */}
          <View style={styles.header}>
            <Pressable
              onPress={handleBack}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back to product list"
            >
              <Feather name="arrow-left" size={18} color={colors.textSecondary} />
            </Pressable>
            <View style={[styles.headerText, styles.headerTextIndented]}>
              <Text style={styles.title} numberOfLines={1}>
                {pendingProduct?.name ?? 'Set schedule'}
              </Text>
              <Text style={styles.subtitle}>Choose when to use this product</Text>
            </View>
          </View>

          {/* ── Step 2: Time of Day ─────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TIME OF DAY</Text>
            <View style={styles.chipRow}>
              <TimeChip
                icon="sun"
                label="Morning"
                active={morning}
                onPress={() => { setMorning((v) => !v); setValidationError(null); }}
              />
              <TimeChip
                icon="moon"
                label="Evening"
                active={evening}
                onPress={() => { setEvening((v) => !v); setValidationError(null); }}
              />
            </View>
          </View>

          {validationError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{validationError}</Text>
            </View>
          ) : null}

          {/* ── Step 2: Weekly Planner ──────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WEEKLY PLANNER</Text>
            <WeeklySchedulePicker scheduledDays={scheduledDays} onUpdate={setScheduledDays} />
          </View>

          {/* ── Step 2: Actions ─────────────────────────────────────────────── */}
          <View style={styles.actions}>
            <Button variant="secondary" size="lg" onPress={handleBack} style={styles.actionBtn}>
              Back
            </Button>
            <Button size="lg" onPress={handleSave} style={styles.actionBtn}>
              Add to routine
            </Button>
          </View>
        </>
      )}
    </BottomSheet>
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
  // ── Shared header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    flexShrink: 0,
  },

  // ── Step 1: search
  searchSection: {
    paddingBottom: space[3],
  },
  filtersScroll: {
    // negates BottomSheet's paddingHorizontal: space[4] to bleed chips edge-to-edge
    marginHorizontal: -space[4],
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: space[4],
    gap: space[2],
    paddingVertical: space[1],
  },
  productList: {
    marginTop: space[4],
  },
  productListContent: {
    gap: space[3],
    paddingBottom: space[6],
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
    backgroundColor: colors.statusSOSTint,
    borderRadius: radius.sm,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderLeftWidth: 3,
    borderLeftColor: colors.statusSOS,
    marginBottom: space[5],
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.statusSOS,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: space[3],
    marginTop: space[4],
    paddingBottom: space[2],
  },
  actionBtn: {
    flex: 1,
  },
});
