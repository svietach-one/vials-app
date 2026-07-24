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
import { IconButton } from '@/components/ui/core/IconButton';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
import type { CosmeticProcedureKey, UserProcedureLog } from '@/types';
import {
  computeStatus,
  getProcedureDisplayName,
  getProgress,
  getRepeatDate,
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
  /** Opens the "…" action sheet (Details / Move to history / Delete). */
  onOpenMenu: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30.44;

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Filled bars are plum-monochrome; completed/archived read as muted grey.
const DONE_STATUSES: ReadonlySet<ComputedStatus> = new Set(['completed', 'archived']);

// Leading Feather glyph per procedure, shown in a plum tint circle like the
// icon treatment used across My Shelf / Routines cards.
const PROCEDURE_ICON: Record<CosmeticProcedureKey, keyof typeof Feather.glyphMap> = {
  botox:              'zap',
  fillers:            'droplet',
  smas_lifting:       'trending-up',
  mesotherapy:        'grid',
  chemical_peel_deep: 'layers',
  mechanical_facial:  'wind',
};

function getProcedureIcon(proc: UserProcedureLog): keyof typeof Feather.glyphMap {
  if (proc.procedureKey === 'custom') return 'activity';
  return PROCEDURE_ICON[proc.procedureKey] ?? 'activity';
}

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
        return `Est. return ${formatDate(proc.estimatedReturnDate)} · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`;
      }
      const monthsLeft = Math.ceil(config.fadeTriggerMonth - elapsedMonths);
      return `Month ${Math.floor(elapsedMonths) + 1} of ${config.fadeTriggerMonth} · fading check in ~${monthsLeft} month${monthsLeft !== 1 ? 's' : ''}`;
    }
    case 'fading':
      return `Month ${Math.floor(elapsedMonths) + 1} — check if the effect is still visible`;
    case 'completed':
      return isCustomProcedure(proc)
        ? `Estimated return date reached (${formatDate(proc.estimatedReturnDate)})`
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
          <IconButton
            icon={<Feather name="x" size={16} color={colors.textTertiary} />}
            label="Cancel custom duration entry"
            variant="ghost"
            size="xs"
            onPress={() => setShowDuration(false)}
          />
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
          <Text style={fadingStyles.optionText}>Still visible</Text>
        </Pressable>
        <Pressable
          style={fadingStyles.optionBtn}
          onPress={() => setShowDuration(true)}
          accessibilityRole="button"
        >
          <Text style={fadingStyles.optionText}>Mostly faded</Text>
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
    backgroundColor: palette.plumTint,
    borderWidth: 1,
    borderColor: palette.plumLine,
    gap: space[2],
  },
  question: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.plum,
  },
  deferred: {
    ...typography.bodySmall,
    color: palette.plum,
    fontStyle: 'italic',
  },
  btnRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  optionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[3],
    borderRadius: radius.sm,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: palette.plumLine,
  },
  optionText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.plum,
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

const BAR_SEGMENTS = 14;
// Point along the track (0–1) where the plum starts losing intensity. Before it
// the fill is full-strength; after it the colour eases toward plumFade.
const FADE_START = 0.5;

/** Linear blend of two #rrggbb hex colours; t=0 → a, t=1 → b. */
function mixHex(a: string, b: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mixed = pa.map((c, i) => Math.round(c + (pb[i] - c) * clamped));
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Segmented lifespan bar. Filled segments hold full plum through the first half
 * of the track, then ease toward a lighter plum so the tail reads as "fading"
 * without the whole bar dimming. Completed/archived bars stay muted grey.
 */
function LifespanBar({ progress, isDone }: { progress: number; isDone: boolean }) {
  const filled = Math.round(progress * BAR_SEGMENTS);
  return (
    <View style={barStyles.track}>
      {Array.from({ length: BAR_SEGMENTS }, (_, i) => {
        const isFilled = i < filled;
        const position = (i + 0.5) / BAR_SEGMENTS;
        let color: string = colors.surfaceSunken;
        if (isFilled) {
          if (isDone) {
            color = colors.borderStrong;
          } else if (position <= FADE_START) {
            color = palette.plum;
          } else {
            color = mixHex(palette.plum, palette.plumFade, (position - FADE_START) / (1 - FADE_START));
          }
        }
        return <View key={i} style={[barStyles.segment, { backgroundColor: color }]} />;
      })}
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: 8,
    gap: 3,
  },
  segment: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
  },
});

// ─── Main card ────────────────────────────────────────────────────────────────

export function ProcedureLifespanCard({ proc, onUpdate, onOpenMenu }: ProcedureLifespanCardProps) {
  const now = new Date();
  const status = computeStatus(proc, now);
  const progress = getProgress(proc, now);
  const procName = getProcedureDisplayName(proc);
  const isDone = DONE_STATUSES.has(status);

  return (
    <View style={cardStyles.card}>
      {/* Header row */}
      <View style={cardStyles.header}>
        <View style={[cardStyles.iconCircle, isDone && cardStyles.iconCircleMuted]}>
          <Feather
            name={getProcedureIcon(proc)}
            size={20}
            color={isDone ? colors.textTertiary : palette.plum}
          />
        </View>
        <View style={cardStyles.headerLeft}>
          <Text style={cardStyles.procName}>{procName}</Text>
          <Text style={cardStyles.date}>{formatDate(proc.datePerformed)}</Text>
        </View>
        <IconButton
          icon={<Feather name="more-horizontal" size={18} color={colors.textSecondary} />}
          label={`Options for ${procName}`}
          variant="ghost"
          size="xs"
          style={cardStyles.menuBtn}
          onPress={onOpenMenu}
        />
      </View>

      {/* Progress bar */}
      <LifespanBar progress={progress} isDone={isDone} />

      {/* Time label */}
      <Text style={cardStyles.timeLabel}>{getTimeLabel(proc, status, now)}</Text>

      {/* Fading prompt — only when actively fading and not yet 3x deferred */}
      {status === 'fading' ? (
        <FadingInteractivePrompt proc={proc} procName={procName} onUpdate={onUpdate} />
      ) : null}

      {/* Repeat-around footer — the estimated date the effect fully lapses */}
      {(status === 'active' || status === 'fading') ? (
        <View style={cardStyles.footer}>
          <Text style={cardStyles.footerLabel}>Repeat around</Text>
          <Text style={cardStyles.footerDate}>{formatDate(getRepeatDate(proc).toISOString())}</Text>
        </View>
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
    ...shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: palette.plumTint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconCircleMuted: {
    backgroundColor: colors.surfaceSunken,
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
  menuBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  timeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
    paddingTop: space[3],
    gap: 2,
  },
  footerLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  footerDate: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: palette.plum,
  },
});
