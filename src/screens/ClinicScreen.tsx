import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AddProcedureModal } from '@/components/clinic/AddProcedureModal';
import { ProcedureActionSheet } from '@/components/clinic/ProcedureActionSheet';
import { ProcedureLifespanCard } from '@/components/clinic/ProcedureLifespanCard';
import { DeleteProductModal } from '@/components/product/DeleteProductModal';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
import type { ClinicStackParamList } from '@/navigation/AppNavigator';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProfileStore } from '@/store/profileStore';
import { getProcedureDisplayName } from '@/utils/procedureLifespanHelpers';
import type { UserProcedureLog } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<ClinicStackParamList, 'Clinic'>;

type ClinicTab = 'active' | 'history';

const TAB_OPTIONS: { value: ClinicTab; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'history', label: 'History' },
];

// ─── Plum tab toggle (matches the Routines list/calendar pill) ────────────────

function ClinicTabs({ tab, onChange }: { tab: ClinicTab; onChange: (t: ClinicTab) => void }) {
  return (
    <View style={tabStyles.group}>
      {TAB_OPTIONS.map(({ value, label }) => {
        const active = value === tab;
        return (
          <Pressable
            key={value}
            style={[tabStyles.btn, active && tabStyles.btnActive]}
            onPress={() => onChange(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${label} procedures`}
            hitSlop={4}
          >
            <Text style={[tabStyles.label, active && tabStyles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    gap: space[1],
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    padding: space[1],
    ...shadow.sm,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
  },
  btnActive: {
    backgroundColor: palette.plum,
  },
  label: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  labelActive: {
    color: palette.white,
  },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function ClinicEmptyState({ tab }: { tab: ClinicTab }) {
  if (tab === 'history') {
    return (
      <View style={emptyStyles.wrap}>
        <Icon name="archive" size={32} color={colors.textTertiary} />
        <Text style={emptyStyles.title}>Nothing archived yet</Text>
        <Text style={emptyStyles.body}>
          Procedures you move to history will appear here so your active list stays focused.
        </Text>
      </View>
    );
  }
  return (
    <View style={emptyStyles.wrap}>
      <Icon name="activity" size={32} color={colors.textTertiary} />
      <Text style={emptyStyles.title}>No procedures logged</Text>
      <Text style={emptyStyles.body}>
        Log a cosmetic procedure to track its rehab window, effect lifespan, and ingredient safety rules.
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: space[8],
    paddingTop: space[12],
    gap: space[3],
  },
  title: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  body: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
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

export default function ClinicScreen({ navigation }: Props) {
  const procedures = useProceduresStore((s) => s.procedures);
  const addProcedure = useProceduresStore((s) => s.addProcedure);
  const updateProcedure = useProceduresStore((s) => s.updateProcedure);
  const removeProcedure = useProceduresStore((s) => s.removeProcedure);
  const profile = useProfileStore((s) => s.profile);

  const [modalVisible, setModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [menuTarget, setMenuTarget] = useState<UserProcedureLog | null>(null);
  const [tab, setTab] = useState<ClinicTab>('active');

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
        <ClinicTabs tab={tab} onChange={setTab} />
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
        ListEmptyComponent={<ClinicEmptyState tab={tab} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Log-procedure CTA only in the empty state; otherwise the header "+" covers it */}
      {data.length === 0 ? (
        <View style={styles.footer}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={<Icon name="plus" size={18} color={palette.white} />}
            onPress={() => setModalVisible(true)}
            accessibilityLabel="Log procedure"
          >
            Log procedure
          </Button>
        </View>
      ) : null}

      <AddProcedureModal
        visible={modalVisible}
        procedures={procedures}
        onClose={() => setModalVisible(false)}
        onSave={(log) => {
          addProcedure(log);
          setModalVisible(false);
        }}
      />

      <ProcedureActionSheet
        proc={menuTarget}
        onDetails={(p) => navigation.navigate('ProcedureDetail', { procedureId: p.id })}
        onMoveToHistory={(p) => updateProcedure(p.id, { status: 'archived' })}
        onDelete={(p) => setDeleteTarget({ id: p.id, name: getProcedureDisplayName(p) })}
        onClose={() => setMenuTarget(null)}
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
    ...typography.bodySmall,
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
  footer: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[3],
    paddingBottom: space[2],
  },
});
