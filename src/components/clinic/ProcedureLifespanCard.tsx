import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Input } from '@/components/ui/forms/Input';
import { Button } from '@/components/ui/core/Button';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { UserProcedureLog } from '@/types';
import {
  computeStatus,
  getProcedureDisplayName,
  getProgress,
  getTimelineConfig,
  isCustomProcedure,
  type ComputedStatus,
} from '@/utils/procedureLifespanHelpers';

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { ComputedStatus } from '@/utils/procedureLifespanHelpers';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcedureLifespanCardProps {
  proc: UserProcedureLog;
  onUpdate: (patch: Partial<UserProcedureLog>) => void;
  onRemove: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30.44;

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_CONFIG: Record<
  ComputedStatus,
  { label: string; bg: string; text: string; barFill: string }
> = {
  rehab:     { label: 'Rehab',     bg: palette.cabernetTint,    text: palette.cabernet,    barFill: palette.cabernet    },
  active:    { label: 'Active',    bg: palette.bottleGreenTint, text: palette.bottleGreen, barFill: palette.bottleGreen },
  fading:    { label: 'Fading?',   bg: palette.amberTint,       text: palette.amber,       barFill: palette.amber       },
  completed: { label: 'Completed', bg: colors.surfaceSunken,    text: colors.textSecondary,barFill: colors.borderStrong },
  archived:  { label: 'Archived',  bg: colors.surfaceSunken,    text: colors.textTertiary, barFill: colors.borderDivider},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeLabel(proc: UserProcedureLog, status: ComputedStatus, now: Date): string {
  const config = getTimelineConfig(proc);
  const elapsedDays = (now.getTime() - new Date(proc.datePerformed).getTime()) / MS_PER_DAY;
  const elapsedMonths = elapsedDays / DAYS_PER_MONTH;

  switch (status) {
    case 'rehab': {
      const left = Math.max(0, Math.ceil(config.rehabDays - elapsedDays));
      return `Day ${Math.ceil(elapsedDays)} of rehab · ${left} day${left !== 1 ? 's' : ''} remaining`;
    }
    case 'active': {
      if (isCustomProcedure(proc)) {
        const daysLeft = Math.max(0, Math.ceil(config.totalEffectMonths * DAYS_PER_MONTH - elapsedDays));
        return `Est. return ${formatDate(proc.estimatedReturnDate!)} · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`;
      }
      const monthsLeft = Math.ceil(config.fadeTriggerMonth - elapsedMonths);
      return `Month ${Math.floor(elapsedMonths) + 1} of ${config.fadeTriggerMonth} · fading check in ~${monthsLeft} month${monthsLeft !== 1 ? 's' : ''}`;
    }
    case 'fading':
      return `Month ${Math.floor(elapsedMonths) + 1} — check if the effect is still visible`;
    case 'completed':
      return isCustomProcedure(proc)
        ? `Estimated return date reached (${formatDate(proc.estimatedReturnDate!)})`
        : `Full ${config.totalEffectMonths}-month cycle complete`;
    case 'archived':
      return proc.realDuration
        ? `Lasted ~${proc.realDuration} months (your record)`
        : 'Archived';
  }
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── FadingInteractivePrompt ──────────────────────────────────────────────────

function FadingInteractivePrompt({
  proc,
  procName,
  onUpdate,
}: {
  proc: UserProcedureLog;
  procName: string;
  onUpdate: (patch: Partial<UserProcedureLog>) => void;
}) {
  const [showDuration, setShowDuration] = useState(false);
  const [durationText, setDurationText] = useState('');

  if (proc.deferralCount >= 3) {
    return (
      <View style={fadingStyles.container}>
        <Text style={fadingStyles.deferred}>
          Prompt deferred 3x — archive when ready.
        </Text>
      </View>
    );
  }

  if (showDuration) {
    const months = parseInt(durationText, 10);
    const valid = Number.isFinite(months) && months > 0;
    return (
      <View style={fadingStyles.container}>
        <Text style={fadingStyles.question}>How many months did it last?</Text>
        <View style={fadingStyles.durationRow}>
          <Input
            value={durationText}
            onChangeText={setDurationText}
            keyboardType="number-pad"
            placeholder="e.g. 5"
            suffix="months"
            containerStyle={fadingStyles.durationInput}
            returnKeyType="done"
          />
          <Button
            variant="primary"
            size="sm"
            disabled={!valid}
            onPress={() => {
              if (valid) onUpdate({ status: 'archived', realDuration: months });
            }}
          >
            Confirm
          </Button>
          <Pressable onPress={() => setShowDuration(false)} hitSlop={8}>
            <Feather name="x" size={16} color={colors.textTertiary} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={fadingStyles.container}>
      <Text style={fadingStyles.question}>
        Still seeing results from {procName}?
      </Text>
      <View style={fadingStyles.btnRow}>
        <Pressable
          style={fadingStyles.optionBtn}
          onPress={() => onUpdate({ deferralCount: proc.deferralCount + 1 })}
          accessibilityRole="button"
        >
          <Feather name="check" size={13} color={palette.bottleGreen} />
          <Text style={[fadingStyles.optionText, { color: palette.bottleGreen }]}>
            Still visible
          </Text>
        </Pressable>
        <Pressable
          style={fadingStyles.optionBtn}
          onPress={() => setShowDuration(true)}
          accessibilityRole="button"
        >
          <Feather name="trending-down" size={13} color={palette.amber} />
          <Text style={[fadingStyles.optionText, { color: palette.amber }]}>
            Mostly faded
          </Text>
        </Pressable>
        <Pressable
          style={fadingStyles.optionBtn}
          onPress={() => onUpdate({ status: 'archived' })}
          accessibilityRole="button"
        >
          <Feather name="archive" size={13} color={colors.textTertiary} />
          <Text style={[fadingStyles.optionText, { color: colors.textTertiary }]}>
            Archive
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const fadingStyles = StyleSheet.create({
  container: {
    marginTop: space[3],
    padding: space[3],
    borderRadius: radius.sm,
    backgroundColor: palette.amberTint,
    borderWidth: 1,
    borderColor: palette.amberLine,
    gap: space[2],
  },
  question: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.amber,
  },
  deferred: {
    ...typography.bodySmall,
    color: palette.amber,
    fontStyle: 'italic',
  },
  btnRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  optionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: space[2],
    borderRadius: radius.xs,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: palette.amberLine,
  },
  optionText: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  durationInput: {
    flex: 1,
  },
});

// ─── LifespanBar ──────────────────────────────────────────────────────────────

function LifespanBar({
  progress,
  barFill,
}: {
  progress: number;
  barFill: string;
}) {
  const pct = `${Math.round(progress * 100)}%`;
  return (
    <View style={barStyles.track}>
      {/* Filled */}
      <View style={{ width: pct as `${number}%`, backgroundColor: barFill, borderRadius: 4 }} />
      {/* Unfilled */}
      <View style={{ flex: 1, backgroundColor: colors.surfaceSunken }} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
  },
});

// ─── Main card ────────────────────────────────────────────────────────────────

export function ProcedureLifespanCard({ proc, onUpdate, onRemove }: ProcedureLifespanCardProps) {
  const now = new Date();
  const status = computeStatus(proc, now);
  const cfg = STATUS_CONFIG[status];
  const progress = getProgress(proc, now);
  const procName = getProcedureDisplayName(proc);

  return (
    <View style={cardStyles.card}>
      {/* Header row */}
      <View style={cardStyles.header}>
        <View style={cardStyles.headerLeft}>
          <Text style={cardStyles.procName}>{procName}</Text>
          <Text style={cardStyles.date}>{formatDate(proc.datePerformed)}</Text>
        </View>
        <View style={cardStyles.headerRight}>
          <View style={[cardStyles.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[cardStyles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
          <Pressable
            onPress={onRemove}
            style={cardStyles.removeBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${procName}`}
          >
            <Feather name="trash-2" size={14} color={colors.textTertiary} />
          </Pressable>
        </View>
      </View>

      {/* Progress bar */}
      <LifespanBar progress={progress} barFill={cfg.barFill} />

      {/* Time label */}
      <Text style={cardStyles.timeLabel}>{getTimeLabel(proc, status, now)}</Text>

      {/* Fading prompt — only when actively fading and not yet 3x deferred */}
      {status === 'fading' ? (
        <FadingInteractivePrompt proc={proc} procName={procName} onUpdate={onUpdate} />
      ) : null}

      {/* Archive link — for active/completed cards */}
      {(status === 'active' || status === 'completed') ? (
        <Pressable
          onPress={() => onUpdate({ status: 'archived' })}
          style={cardStyles.archiveLink}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Archive ${procName}`}
        >
          <Feather name="archive" size={12} color={colors.textTertiary} />
          <Text style={cardStyles.archiveLinkText}>Archive</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    padding: space[4],
    gap: space[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  procName: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  date: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexShrink: 0,
  },
  badge: {
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  badgeText: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceSunken,
  },
  timeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  archiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  archiveLinkText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
