import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, typography } from '@/constants/tokens';
import type { UserProcedureLog } from '@/types';
import {
  buildForecastTimeline,
  FORECAST_WINDOW_MONTHS,
} from '@/utils/forecastTimelineHelpers';
import type { ForecastTrack } from '@/utils/forecastTimelineHelpers';

export interface ForecastTimelineProps {
  /** Pre-filtered to non-archived by ClinicScreen (re-filtered defensively). */
  procedures: UserProcedureLog[];
  onSelectProcedure: (procedureId: string) => void;
  /** Defaults to new Date(); override for deterministic tests. */
  now?: Date;
}

const COLUMN_WIDTH = 56;
const RIBBON_WIDTH = COLUMN_WIDTH * FORECAST_WINDOW_MONTHS;
const TRACK_HEIGHT = 16;

/** One tappable Cobalt→Amber lifecycle bar, absolutely positioned in its row. */
function TrackBar({
  track,
  onSelectProcedure,
}: {
  track: ForecastTrack;
  onSelectProcedure: (procedureId: string) => void;
}) {
  const left = track.startOffset * COLUMN_WIDTH;
  const cobaltWidth = (track.fadeOffset - track.startOffset) * COLUMN_WIDTH;
  const amberWidth = (track.endOffset - track.fadeOffset) * COLUMN_WIDTH;

  return (
    <Pressable
      testID={`forecast-track-${track.procedureId}`}
      accessibilityRole="button"
      accessibilityLabel={`${track.displayName}, ${track.status}. Tap to view its card.`}
      onPress={() => onSelectProcedure(track.procedureId)}
      style={[styles.track, { left, width: cobaltWidth + amberWidth }]}
    >
      <View
        testID={`forecast-segment-${track.procedureId}-cobalt`}
        style={[styles.segmentCobalt, { width: cobaltWidth }]}
      />
      <View
        testID={`forecast-segment-${track.procedureId}-amber`}
        style={[styles.segmentAmber, { width: amberWidth }]}
      />
    </Pressable>
  );
}

/**
 * 12-month forecast ribbon for the Clinic screen (PRD "12_MonthForecastTimeline").
 * Near-pure renderer of buildForecastTimeline output: month header (current
 * month marked), then one lane per row of clipped Cobalt/Amber procedure
 * tracks. Tapping a track reports its procedure id to the parent.
 */
export function ForecastTimeline({ procedures, onSelectProcedure, now }: ForecastTimelineProps) {
  const data = buildForecastTimeline(procedures, now ?? new Date());
  const rows = Array.from({ length: data.rowCount }, (_, row) =>
    data.tracks.filter((track) => track.row === row),
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      testID="forecast-timeline"
      style={styles.strip}
      contentContainerStyle={styles.content}
    >
      <View style={styles.ribbon}>
        <View testID="forecast-month-header" style={styles.monthHeader}>
          {data.months.map((month, index) => (
            <View
              key={month.key}
              testID={`forecast-month-${index}`}
              accessibilityLabel={`${month.label} ${month.year}`}
              accessibilityState={{ selected: month.isCurrent }}
              style={[styles.monthColumn, month.isCurrent && styles.monthColumnCurrent]}
            >
              <Text style={[styles.monthLabel, month.isCurrent && styles.monthLabelCurrent]}>
                {month.label}
              </Text>
            </View>
          ))}
        </View>
        {rows.map((rowTracks, row) => (
          <View key={row} testID={`forecast-row-${row}`} style={styles.row}>
            {rowTracks.map((track) => (
              <TrackBar
                key={track.procedureId}
                track={track}
                onSelectProcedure={onSelectProcedure}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginBottom: space[2],
  },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[3],
  },
  ribbon: {
    width: RIBBON_WIDTH,
  },
  monthHeader: {
    flexDirection: 'row',
    marginBottom: space[3],
  },
  monthColumn: {
    width: COLUMN_WIDTH,
    alignItems: 'center',
    paddingBottom: space[1],
    borderBottomWidth: 2,
    borderBottomColor: colors.borderDivider,
  },
  monthColumnCurrent: {
    borderBottomColor: colors.statusInfo,
  },
  monthLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  monthLabelCurrent: {
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  row: {
    width: RIBBON_WIDTH,
    height: TRACK_HEIGHT,
    marginBottom: space[2],
  },
  track: {
    position: 'absolute',
    top: 0,
    height: TRACK_HEIGHT,
    flexDirection: 'row',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  segmentCobalt: {
    height: TRACK_HEIGHT,
    backgroundColor: colors.statusInfo,
  },
  segmentAmber: {
    height: TRACK_HEIGHT,
    backgroundColor: colors.statusWarning,
  },
});
