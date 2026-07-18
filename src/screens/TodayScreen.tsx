import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { colors, radius, space, typography } from '@/constants/tokens';
import { performDailyCheckIn } from '@/domain/trackingActions';
import { getActiveSeasonMask } from '@/domain/seasonActions';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrackingStore } from '@/store/trackingStore';
import { isCheckedInToday } from '@/utils/routineEngine/cycleState';
import {
  getDailyView,
  getDynamicCycleStatus,
  type DailyRoutineView,
} from '@/utils/routineEngine/dailyView';
import type { Product } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CYCLE_PHASE_LABELS: Record<string, string> = {
  exfoliation: 'Exfoliation night',
  retinoid: 'Retinoid night',
  recovery: 'Recovery night',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const routines = useRoutinesStore((s) => s.routines);
  const products = useProductsStore((s) => s.products);
  const procedures = useProceduresStore((s) => s.procedures);
  const profile = useProfileStore((s) => s.profile);
  const cycleType = useSettingsStore((s) => s.routineCycleType);
  const cycleState = useTrackingStore((s) => s.cycleState);

  // Bumps after a check-in so the memoized view recomputes immediately
  const [checkInTick, setCheckInTick] = useState(0);

  const dynamicInput = useMemo(
    () => ({
      procedures,
      profile: { fitzpatrick: profile?.fitzpatrick ?? null },
      seasonMask: getActiveSeasonMask(),
      ...(cycleType === 'dynamic'
        ? { cycle: { type: cycleType, state: cycleState } }
        : {}),
    }),
    [procedures, profile, cycleType, cycleState],
  );

  const views = useMemo(
    () => getDailyView(routines, products, dynamicInput),
    [routines, products, dynamicInput, checkInTick],
  );

  const isDynamic = cycleType === 'dynamic';
  const checkedIn = isCheckedInToday(cycleState);
  // phase-06: tonight's phase resolved against the shelf; recovery when the
  // scheduled active is absent, and a "paused" notice when nothing cycles.
  const cycleStatus = useMemo(
    () => getDynamicCycleStatus(products, dynamicInput),
    [products, dynamicInput],
  );

  function handleCheckIn() {
    performDailyCheckIn();
    setCheckInTick((t) => t + 1);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader title="Today" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isDynamic ? (
          cycleStatus.available ? (
            <View style={styles.phaseCard}>
              <Feather name="moon" size={16} color={colors.textSecondary} />
              <Text style={styles.phaseText}>{CYCLE_PHASE_LABELS[cycleStatus.phase]}</Text>
            </View>
          ) : (
            <View style={styles.phaseCard}>
              <Feather name="alert-circle" size={16} color={colors.textSecondary} />
              <Text style={styles.phaseText}>
                Skin cycling is paused — add an exfoliant or retinoid to your shelf, or switch
                back to fixed days in Profile.
              </Text>
            </View>
          )
        ) : null}

        {views.map((view) => (
          <RoutineBlock key={view.routineId} view={view} products={products} />
        ))}

        {isDynamic ? (
          <View style={styles.checkInWrap}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={checkedIn}
              onPress={handleCheckIn}
              accessibilityLabel="Complete My Routine"
            >
              {checkedIn ? 'Routine completed for today' : 'Complete My Routine'}
            </Button>
            {!checkedIn ? (
              <Text style={styles.checkInHint}>
                One tap per day advances your skin cycle and adaptation tracking.
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Routine block ────────────────────────────────────────────────────────────

function RoutineBlock({ view, products }: { view: DailyRoutineView; products: Product[] }) {
  const nameOf = (productId: string | null) =>
    (productId && products.find((p) => p.id === productId)?.name) ?? 'Product removed';

  const empty =
    view.steps.length === 0 && view.frozen.length === 0 && view.cycledOut.length === 0;

  return (
    <View style={styles.routineCard}>
      <Text style={styles.routineTitle}>
        {view.timeOfDay === 'morning' ? 'Morning' : 'Evening'}
      </Text>

      {empty ? <Text style={styles.emptyText}>Nothing scheduled today.</Text> : null}

      {view.steps.map((step) => (
        <View key={step.id} style={styles.stepRow}>
          <Feather name="circle" size={14} color={colors.textTertiary} />
          <Text style={styles.stepName} numberOfLines={1}>
            {nameOf(step.productId)}
          </Text>
        </View>
      ))}

      {view.frozen.map((item) => (
        <View key={item.stepId} style={styles.stepRow}>
          <Feather name="pause-circle" size={14} color={colors.textTertiary} />
          <Text style={styles.pausedName} numberOfLines={1}>
            {nameOf(item.productId)} — paused until {item.until}
          </Text>
        </View>
      ))}

      {view.cycledOut.map((item) => (
        <View key={item.stepId} style={styles.stepRow}>
          <Feather name="rotate-cw" size={14} color={colors.textTertiary} />
          <Text style={styles.pausedName} numberOfLines={1}>
            {nameOf(item.productId)} — not tonight
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[5],
    paddingBottom: space[16],
    gap: space[4],
  },
  phaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  phaseText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  routineCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    padding: space[4],
    gap: space[3],
  },
  routineTitle: {
    ...typography.label,
    color: colors.textSecondary,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  stepName: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  pausedName: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    flexShrink: 1,
  },
  checkInWrap: {
    gap: space[2],
    marginTop: space[2],
  },
  checkInHint: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
