import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AddProcedureModal } from '@/components/clinic/AddProcedureModal';
import { ProcedureDurationFeedbackModal } from '@/components/clinic/ProcedureDurationFeedbackModal';
import { ProcedureActionSheet } from '@/components/clinic/ProcedureActionSheet';
import { ProcedureLifespanCard } from '@/components/clinic/ProcedureLifespanCard';
import { DeleteProductModal } from '@/components/product/DeleteProductModal';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { EmptyState } from '@/components/ui/core/EmptyState';
import { IconButton } from '@/components/ui/core/IconButton';
import { PillToggle } from '@/components/ui/core/PillToggle';
import { Toast } from '@/components/ui/feedback/Toast';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { archiveProcedure, logProcedure } from '@/domain/procedureActions';
import type { ClinicStackParamList } from '@/navigation/AppNavigator';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProfileStore } from '@/store/profileStore';
import { formatMonths } from '@/utils/metabolismCalibration';
import { getProcedureDisplayName } from '@/utils/procedureLifespanHelpers';
import type { UserProcedureLog } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<ClinicStackParamList, 'Clinic'>;

type ClinicTab = 'active' | 'history';

const TAB_OPTIONS: { value: ClinicTab; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'history', label: 'History' },
];

// ─── Empty state ──────────────────────────────────────────────────────────────

function ClinicEmptyState({ tab, onLogProcedure }: { tab: ClinicTab; onLogProcedure: () => void }) {
  // Action lives inside the empty state itself (matches Routines/Catalog/
  // Calendar empty states) rather than a separate sticky footer.
  const logAction = [
    {
      label: 'Log procedure',
      onPress: onLogProcedure,
      icon: <Icon name="plus" size={16} color={palette.white} />,
    },
  ];

  if (tab === 'history') {
    return (
      <View style={emptyStyles.wrap}>
        <EmptyState
          icon={<Icon name="archive" size={24} color={colors.textSecondary} />}
          title="Nothing archived yet"
          description="Procedures you move to history will appear here so your active list stays focused."
          actions={logAction}
        />
      </View>
    );
  }
  return (
    <View style={emptyStyles.wrap}>
      <EmptyState
        icon={<Icon name="activity" size={24} color={colors.textSecondary} />}
        title="No procedures logged"
        description="Log a cosmetic procedure to track its rehab window, effect lifespan, and ingredient safety rules."
        actions={logAction}
      />
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: space[8],
    paddingTop: space[12],
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

// Reuse DeleteProductModal with a compatible prop shape
interface DeleteTarget {
  id: string;
  name: string;
}

function makeFakeProduct(t: DeleteTarget) {
  return { id: t.id, name: t.name } as Parameters<typeof DeleteProductModal>[0]['product'] & object;
}

interface EstimateToast {
  title: string;
  subtitle: string;
}

/**
 * "Move to history" flow. Pre-defined procedures first ask how long the effect
 * lasted (calibration); custom ones archive straight away. The question opens
 * from the action sheet's close so two Modals never transition at once.
 */
function useArchiveFlow() {
  const [feedbackTarget, setFeedbackTarget] = useState<UserProcedureLog | null>(null);
  const [toast, setToast] = useState<EstimateToast | null>(null);
  const pendingRef = useRef<UserProcedureLog | null>(null);

  function archive(proc: UserProcedureLog, months: number | null) {
    const result = archiveProcedure(proc.id, months);
    if (result.status === 'calibrated' && result.from !== undefined && result.to !== undefined) {
      setToast({
        title: 'Estimate updated',
        subtitle: `${getProcedureDisplayName(proc)}: ${formatMonths(result.from)} \u2192 ${formatMonths(result.to)} months`,
      });
    }
  }

  function requestMoveToHistory(proc: UserProcedureLog) {
    if (proc.procedureKey === 'custom') archive(proc, null);
    else pendingRef.current = proc;
  }

  function openPendingFeedback() {
    if (!pendingRef.current) return;
    setFeedbackTarget(pendingRef.current);
    pendingRef.current = null;
  }

  function confirmFeedback(months: number | null) {
    if (feedbackTarget) archive(feedbackTarget, months);
    setFeedbackTarget(null);
  }

  const hideToast = useCallback(() => setToast(null), []);

  return {
    feedbackTarget,
    toast,
    archive,
    requestMoveToHistory,
    openPendingFeedback,
    confirmFeedback,
    cancelFeedback: () => setFeedbackTarget(null),
    hideToast,
  };
}

export default function ClinicScreen({ navigation }: Props) {
  const procedures = useProceduresStore((s) => s.procedures);
  const updateProcedure = useProceduresStore((s) => s.updateProcedure);
  const removeProcedure = useProceduresStore((s) => s.removeProcedure);
  const profile = useProfileStore((s) => s.profile);

  const [modalVisible, setModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [menuTarget, setMenuTarget] = useState<UserProcedureLog | null>(null);
  const [tab, setTab] = useState<ClinicTab>('active');
  const flow = useArchiveFlow();

  // Most recent first, then split by tab (Active = ongoing, History = archived)
  const sorted = [...procedures].sort(
    (a, b) => new Date(b.datePerformed).getTime() - new Date(a.datePerformed).getTime(),
  );
  const data = sorted.filter((p) =>
    tab === 'history' ? p.status === 'archived' : p.status !== 'archived',
  );

  function renderItem({ item }: { item: UserProcedureLog }) {
    return (
      <ProcedureLifespanCard
        proc={item}
        onUpdate={(patch) => updateProcedure(item.id, patch)}
        onOpenMenu={() => setMenuTarget(item)}
        onReportDuration={(months) => flow.archive(item, months)}
        skinConditions={profile?.skinConditions ?? []}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Clinic"
        rightAction={
          <IconButton
            icon={<Icon name="plus" size={20} color={colors.textPrimary} />}
            label="Log procedure"
            variant="ghost"
            size="sm"
            onPress={() => setModalVisible(true)}
          />
        }
      />
      <View style={styles.controls}>
        <PillToggle
          value={tab}
          onValueChange={(v) => setTab(v as ClinicTab)}
          options={TAB_OPTIONS.map(({ value, label }) => ({
            value,
            label,
            accessibilityLabel: `${label} procedures`,
          }))}
        />
        <Text style={styles.subtitle}>
          {tab === 'history'
            ? 'Procedures you have moved to history.'
            : 'Your ongoing procedures and their progress.'}
        </Text>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          data.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={
          <ClinicEmptyState tab={tab} onLogProcedure={() => setModalVisible(true)} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <AddProcedureModal
        visible={modalVisible}
        procedures={procedures}
        onClose={() => setModalVisible(false)}
        onSave={(log) => {
          logProcedure(log);
          setModalVisible(false);
        }}
      />

      <ProcedureActionSheet
        proc={menuTarget}
        onDetails={(p) => navigation.navigate('ProcedureDetail', { procedureId: p.id })}
        onMoveToHistory={flow.requestMoveToHistory}
        onDelete={(p) => setDeleteTarget({ id: p.id, name: getProcedureDisplayName(p) })}
        onClose={() => {
          setMenuTarget(null);
          flow.openPendingFeedback();
        }}
      />

      <ProcedureDurationFeedbackModal
        proc={flow.feedbackTarget}
        onConfirm={flow.confirmFeedback}
        onCancel={flow.cancelFeedback}
      />

      <DeleteProductModal
        product={deleteTarget ? makeFakeProduct(deleteTarget) : null}
        onConfirm={() => {
          if (deleteTarget) {
            removeProcedure(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast
        visible={flow.toast !== null}
        title={flow.toast?.title ?? ''}
        subtitle={flow.toast?.subtitle}
        onHide={flow.hideToast}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  controls: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[6],
    paddingBottom: space[3],
    gap: space[2],
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  list: {
    paddingHorizontal: space.gutterScreen,
    paddingBottom: space[4],
    paddingTop: space[1],
  },
  listEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: space.gapCard,
  },
});
