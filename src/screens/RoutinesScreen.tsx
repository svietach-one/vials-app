import React, { useEffect, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { ClinicalRestrictionsBlock } from '@/components/routine/ClinicalRestrictionsBlock';
import { SeasonalNoticeBanner } from '@/components/routine/SeasonalNoticeBanner';
import { WeeklyPlanView } from '@/components/routine/WeeklyPlanView';
import { Button } from '@/components/ui/core/Button';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { RootTabParamList } from '@/navigation/AppNavigator';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Product, Routine, RoutineStep } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = BottomTabScreenProps<RootTabParamList, 'Routine Hub'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatTodayLabel(date: Date): string {
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

function isStepForToday(step: RoutineStep, dayOfWeek: number): boolean {
  const days = step.scheduledDays ?? [];
  return days.length === 0 || days.includes(dayOfWeek);
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  cleanser: 'Cleanser',
  toner: 'Toner',
  essence: 'Essence',
  serum: 'Serum',
  gel: 'Gel',
  moisturizer: 'Moisturizer',
  oil: 'Oil',
  spf: 'SPF',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RoutinesScreen({ navigation }: Props) {
  const products = useProductsStore((s) => s.products);
  const routines = useRoutinesStore((s) => s.routines);
  const setStepHidden = useRoutinesStore((s) => s.setStepHidden);
  const gamificationEnabled = useSettingsStore((s) => s.gamificationEnabled);

  const [view, setView] = useState<'today' | 'weekly'>('today');
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [amCollapsed, setAmCollapsed] = useState(false);
  const [pmCollapsed, setPmCollapsed] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: view === 'today' ? 'Routine Hub' : 'Edit Schedule',
      headerRight: () => (
        <Pressable
          onPress={() => setView((v) => (v === 'today' ? 'weekly' : 'today'))}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={view === 'today' ? 'Edit schedule' : 'Back to today'}
        >
          <Text style={styles.headerBtnText}>
            {view === 'today' ? 'Edit Schedule' : 'Done'}
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, view]);

  const today = new Date();
  const todayDow = today.getDay();

  const morningRoutine = routines.find((r) => r.timeOfDay === 'morning');
  const eveningRoutine = routines.find((r) => r.timeOfDay === 'evening');

  const amSteps = (morningRoutine?.steps ?? []).filter(
    (s) => !s.hidden && isStepForToday(s, todayDow),
  );
  const pmSteps = (eveningRoutine?.steps ?? []).filter(
    (s) => !s.hidden && isStepForToday(s, todayDow),
  );

  function toggleComplete(stepId: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }

  function handleHideStep(routine: Routine, stepId: string) {
    setStepHidden(routine.id, stepId, true);
  }

  if (view === 'weekly') {
    return (
      <SafeAreaView style={styles.safe}>
        <WeeklyPlanView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Page header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Today</Text>
          <Text style={styles.dateLabel}>{formatTodayLabel(today)}</Text>
        </View>

        {/* Clinical restrictions (only shows during rehab windows) */}
        <ClinicalRestrictionsBlock />

        {/* Seasonal tip (dismissible) */}
        <SeasonalNoticeBanner />

        {/* AM Section */}
        <RoutineSection
          title="AM"
          collapsed={amCollapsed}
          onToggleCollapse={() => setAmCollapsed((v) => !v)}
          stepCount={amSteps.length}
          completedCount={amSteps.filter((s) => completed.has(s.id)).length}
        >
          {amSteps.length === 0 ? (
            <EmptySection
              message="No steps scheduled for this morning."
              hint="Set up your routine in the Weekly Plan tab."
            />
          ) : (
            amSteps.map((step, index) => {
              const product = step.productId
                ? products.find((p) => p.id === step.productId) ?? null
                : null;

              if (!product) {
                return morningRoutine ? (
                  <EmptySlotPlaceholder
                    key={step.id}
                    step={step}
                    onHide={() => handleHideStep(morningRoutine, step.id)}
                    onAddFromCatalog={() => navigation.navigate('Vials', { screen: 'Catalog' })}
                  />
                ) : null;
              }

              return (
                <RoutineStepCard
                  key={step.id}
                  step={step}
                  product={product}
                  index={index}
                  checked={completed.has(step.id)}
                  gamificationEnabled={gamificationEnabled}
                  onToggle={() => toggleComplete(step.id)}
                />
              );
            })
          )}
        </RoutineSection>

        {/* PM Section */}
        <RoutineSection
          title="PM"
          collapsed={pmCollapsed}
          onToggleCollapse={() => setPmCollapsed((v) => !v)}
          stepCount={pmSteps.length}
          completedCount={pmSteps.filter((s) => completed.has(s.id)).length}
        >
          {pmSteps.length === 0 ? (
            <EmptySection
              message="No steps scheduled for this evening."
              hint="Set up your routine in the Weekly Plan tab."
            />
          ) : (
            pmSteps.map((step, index) => {
              const product = step.productId
                ? products.find((p) => p.id === step.productId) ?? null
                : null;

              if (!product) {
                return eveningRoutine ? (
                  <EmptySlotPlaceholder
                    key={step.id}
                    step={step}
                    onHide={() => handleHideStep(eveningRoutine, step.id)}
                    onAddFromCatalog={() => navigation.navigate('Vials', { screen: 'Catalog' })}
                  />
                ) : null;
              }

              return (
                <RoutineStepCard
                  key={step.id}
                  step={step}
                  product={product}
                  index={index}
                  checked={completed.has(step.id)}
                  gamificationEnabled={gamificationEnabled}
                  onToggle={() => toggleComplete(step.id)}
                />
              );
            })
          )}
        </RoutineSection>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── RoutineSection ───────────────────────────────────────────────────────────

function RoutineSection({
  title,
  collapsed,
  onToggleCollapse,
  stepCount,
  completedCount,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  stepCount: number;
  completedCount: number;
  children: React.ReactNode;
}) {
  const allDone = stepCount > 0 && completedCount === stepCount;

  return (
    <View style={sectionStyles.wrap}>
      {/* Section header */}
      <Pressable
        style={sectionStyles.header}
        onPress={onToggleCollapse}
        accessibilityRole="button"
        accessibilityLabel={`${title} routine, ${collapsed ? 'expand' : 'collapse'}`}
        accessibilityState={{ expanded: !collapsed }}
        hitSlop={8}
      >
        <View style={sectionStyles.headerLeft}>
          <Text style={sectionStyles.title}>{title}</Text>
          {stepCount > 0 ? (
            <View style={[sectionStyles.badge, allDone && sectionStyles.badgeDone]}>
              <Text style={[sectionStyles.badgeText, allDone && sectionStyles.badgeTextDone]}>
                {completedCount}/{stepCount}
              </Text>
            </View>
          ) : null}
        </View>
        <Feather
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {/* Section body */}
      {!collapsed ? (
        <View style={sectionStyles.body}>{children}</View>
      ) : null}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.borderDivider,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceCard,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[4],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  title: {
    ...typography.label,
    color: colors.textPrimary,
  },
  badge: {
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  badgeDone: {
    backgroundColor: palette.bottleGreenTint,
  },
  badgeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  badgeTextDone: {
    color: palette.bottleGreen,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },
});

// ─── RoutineStepCard ──────────────────────────────────────────────────────────

function RoutineStepCard({
  step,
  product,
  index,
  checked,
  gamificationEnabled,
  onToggle,
}: {
  step: RoutineStep;
  product: Product;
  index: number;
  checked: boolean;
  gamificationEnabled: boolean;
  onToggle: () => void;
}) {
  const checkboxFill = gamificationEnabled ? palette.cabernet : palette.black;

  return (
    <Pressable
      style={({ pressed }) => [cardStyles.row, pressed && cardStyles.rowPressed]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${product.name}, step ${index + 1}`}
    >
      {/* Left: order badge + content */}
      <View style={cardStyles.orderBadge}>
        <Text style={cardStyles.orderText}>{index + 1}</Text>
      </View>

      <View style={cardStyles.content}>
        <Text
          style={[cardStyles.name, checked && cardStyles.nameChecked]}
          numberOfLines={1}
        >
          {product.name}
        </Text>
        <View style={cardStyles.meta}>
          {product.brand ? (
            <Text style={cardStyles.brand} numberOfLines={1}>
              {product.brand}
            </Text>
          ) : null}
          <View style={cardStyles.typeBadge}>
            <Text style={cardStyles.typeText}>
              {PRODUCT_TYPE_LABELS[product.productType] ?? product.productType}
            </Text>
          </View>
        </View>
      </View>

      {/* Right: checkbox */}
      <View
        style={[
          cardStyles.checkbox,
          checked && { backgroundColor: checkboxFill, borderColor: checkboxFill },
        ]}
      >
        {checked ? <Feather name="check" size={12} color={palette.white} /> : null}
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3] + 2,
    gap: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
    backgroundColor: colors.bgBase,
  },
  rowPressed: {
    backgroundColor: colors.surfaceSunken,
  },

  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  orderText: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },

  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  nameChecked: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  brand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceSunken,
    flexShrink: 0,
  },
  typeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

// ─── EmptySlotPlaceholder ─────────────────────────────────────────────────────

function EmptySlotPlaceholder({
  step,
  onHide,
  onAddFromCatalog,
}: {
  step: RoutineStep;
  onHide: () => void;
  onAddFromCatalog: () => void;
}) {
  return (
    <View style={emptySlotStyles.row}>
      <View style={emptySlotStyles.content}>
        <Text style={emptySlotStyles.label}>Step empty</Text>
        <Text style={emptySlotStyles.type}>
          {PRODUCT_TYPE_LABELS[step.productType] ?? step.productType}
        </Text>
      </View>
      <View style={emptySlotStyles.actions}>
        <Button variant="secondary" size="sm" onPress={onAddFromCatalog}>
          + Add from catalog
        </Button>
        <Pressable
          onPress={onHide}
          style={emptySlotStyles.hideLink}
          accessibilityRole="button"
          accessibilityLabel="Hide this step"
          hitSlop={8}
        >
          <Text style={emptySlotStyles.hideLinkText}>Hide step</Text>
        </Pressable>
      </View>
    </View>
  );
}

const emptySlotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
    backgroundColor: colors.bgBase,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textTertiary,
  },
  type: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  actions: {
    alignItems: 'flex-end',
    gap: space[2],
    flexShrink: 0,
  },
  hideLink: {
    alignSelf: 'flex-end',
  },
  hideLinkText: {
    ...typography.bodySmall,
    color: colors.textLink,
  },
});

// ─── EmptySection ─────────────────────────────────────────────────────────────

function EmptySection({ message, hint }: { message: string; hint?: string }) {
  return (
    <View style={emptySectionStyles.wrap}>
      <Feather name="inbox" size={24} color={colors.textTertiary} />
      <Text style={emptySectionStyles.message}>{message}</Text>
      {hint ? <Text style={emptySectionStyles.hint}>{hint}</Text> : null}
    </View>
  );
}

const emptySectionStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: space[8],
    paddingHorizontal: space[6],
    gap: space[2],
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

// ─── Screen-level styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[6],
    paddingBottom: space[12],
    gap: space[4],
  },

  headerBtn: {
    paddingRight: space.gutterScreen,
  },
  headerBtnText: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: palette.black,
  },

  pageHeader: {
    gap: space[1],
    marginBottom: space[2],
  },
  pageTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  dateLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
