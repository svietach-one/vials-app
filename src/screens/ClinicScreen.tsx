import React, { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { AddProcedureModal } from '@/components/clinic/AddProcedureModal';
import { ForecastTimeline } from '@/components/clinic/ForecastTimeline';
import { ProcedureLifespanCard } from '@/components/clinic/ProcedureLifespanCard';
import { DeleteProductModal } from '@/components/product/DeleteProductModal';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { IconButton } from '@/components/ui/core/IconButton';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { RootTabParamList } from '@/navigation/AppNavigator';
import { useProceduresStore } from '@/store/proceduresStore';
import { getProcedureDisplayName } from '@/utils/procedureLifespanHelpers';
import type { UserProcedureLog } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = BottomTabScreenProps<RootTabParamList, 'Clinic'>;

// ─── Empty state ──────────────────────────────────────────────────────────────

function ClinicEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={emptyStyles.wrap}>
      <Feather name="activity" size={32} color={colors.textTertiary} />
      <Text style={emptyStyles.title}>No procedures logged</Text>
      <Text style={emptyStyles.body}>
        Log a cosmetic procedure to track its rehab window, effect lifespan, and ingredient safety rules.
      </Text>
      <Pressable
        onPress={onAdd}
        style={emptyStyles.cta}
        accessibilityRole="button"
        accessibilityLabel="Log first procedure"
      >
        <Feather name="plus" size={16} color={palette.white} />
        <Text style={emptyStyles.ctaLabel}>Log Procedure</Text>
      </Pressable>
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
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderRadius: radius.md,
    backgroundColor: palette.black,
    marginTop: space[2],
  },
  ctaLabel: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.white,
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

  const [modalVisible, setModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const flatListRef = useRef<FlatList<UserProcedureLog>>(null);

  // Sort: most recent first; archived pushed to the end
  const sorted = [...procedures].sort((a, b) => {
    if (a.status === 'archived' && b.status !== 'archived') return 1;
    if (a.status !== 'archived' && b.status === 'archived') return -1;
    return new Date(b.datePerformed).getTime() - new Date(a.datePerformed).getTime();
  });

  const visibleProcedures = procedures.filter((p) => p.status !== 'archived');

  function handleSelectProcedure(procedureId: string) {
    const item = sorted.find((p) => p.id === procedureId);
    if (!item) return;
    flatListRef.current?.scrollToItem({ item, animated: true, viewPosition: 0.2 });
  }

  function renderItem({ item }: { item: UserProcedureLog }) {
    return (
      <ProcedureLifespanCard
        proc={item}
        onUpdate={(patch) => updateProcedure(item.id, patch)}
        onRemove={() =>
          setDeleteTarget({
            id: item.id,
            name: getProcedureDisplayName(item),
          })
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Clinic"
        rightAction={
          <IconButton
            icon={<Feather name="plus" size={20} color={palette.black} />}
            label="Log procedure"
            variant="ghost"
            size="sm"
            onPress={() => setModalVisible(true)}
          />
        }
      />
      <FlatList
        ref={flatListRef}
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          sorted.length === 0 && styles.listEmpty,
        ]}
        ListHeaderComponent={
          visibleProcedures.length > 0 ? (
            <ForecastTimeline
              procedures={visibleProcedures}
              onSelectProcedure={handleSelectProcedure}
            />
          ) : null
        }
        ListEmptyComponent={
          <ClinicEmptyState onAdd={() => setModalVisible(true)} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <AddProcedureModal
        visible={modalVisible}
        procedures={procedures}
        onClose={() => setModalVisible(false)}
        onSave={(log) => {
          addProcedure(log);
          setModalVisible(false);
        }}
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
  list: {
    paddingHorizontal: space.gutterScreen,
    paddingBottom: space[12],
    paddingTop: space[2],
  },
  listEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: space[3],
  },
});
