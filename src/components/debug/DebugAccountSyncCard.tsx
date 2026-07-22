import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Button } from '@/components/ui/core/Button';
import { colors, palette, radius, space, typography } from '@/constants/tokens';

/**
 * TEMPORARY DEBUG COMPONENT — remove together with the "Developer Tools"
 * section in ProfileScreen.tsx.
 *
 * Fills the account area with mock Phase 2 (Supabase account sync) data using
 * plain component state — no store writes, no AsyncStorage — so it can't
 * leave anything behind once removed.
 */

interface MockAccountData {
  email: string;
  plan: 'Free' | 'Pro';
  memberSince: string;
  syncedProducts: number;
  syncedRoutines: number;
  syncedProcedures: number;
  lastSyncedAt: string;
}

function buildMockAccountData(): MockAccountData {
  return {
    email: 'preview.user@vials.app',
    plan: 'Pro',
    memberSince: '2025-11-02',
    syncedProducts: 14,
    syncedRoutines: 3,
    syncedProcedures: 2,
    lastSyncedAt: new Date().toISOString(),
  };
}

type SyncStatus = 'idle' | 'loading' | 'loaded';

export function DebugAccountSyncCard() {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [data, setData] = useState<MockAccountData | null>(null);

  function handleSimulate() {
    setStatus('loading');
    setTimeout(() => {
      setData(buildMockAccountData());
      setStatus('loaded');
    }, 700);
  }

  function handleReset() {
    setStatus('idle');
    setData(null);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.hint}>
        Supabase isn't configured yet — this simulates Phase 2 account sync
        with mock data, held only in this screen's local state.
      </Text>

      {status === 'idle' && (
        <Button
          variant="primary"
          size="md"
          fullWidth
          icon={<Feather name="cloud" size={14} color={palette.white} />}
          onPress={handleSimulate}
          accessibilityLabel="Simulate account sync"
          style={styles.button}
        >
          Debug: Simulate Account Sync
        </Button>
      )}

      {status === 'loading' && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text style={styles.loadingText}>Syncing mock account…</Text>
        </View>
      )}

      {status === 'loaded' && data && (
        <View style={styles.resultWrap}>
          <Row label="Email" value={data.email} />
          <Row label="Plan" value={data.plan} />
          <Row label="Member since" value={data.memberSince} />
          <Row label="Synced products" value={String(data.syncedProducts)} />
          <Row label="Synced routines" value={String(data.syncedRoutines)} />
          <Row label="Synced procedures" value={String(data.syncedProcedures)} />
          <Row
            label="Last synced"
            value={new Date(data.lastSyncedAt).toLocaleTimeString()}
          />
          <Button
            variant="textActive"
            size="sm"
            onPress={handleReset}
            accessibilityLabel="Reset simulated account sync"
            style={styles.resetLink}
          >
            Reset
          </Button>
        </View>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[3] },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  button: {
    backgroundColor: colors.statusWarning,
    borderColor: colors.statusWarning,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  resultWrap: {
    gap: space[1],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
    paddingTop: space[2],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  rowLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  resetLink: {
    alignSelf: 'flex-start',
    marginTop: space[2],
  },
});
