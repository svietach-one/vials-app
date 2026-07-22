import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { FilterChip } from '@/components/ui/core/FilterChip';
import { IconButton } from '@/components/ui/core/IconButton';
import { Switch } from '@/components/ui/forms/Switch';
import { colors, radius, space, typography } from '@/constants/tokens';
import type { AddProductDraft } from '@/types';
import type { FormAction } from '@/utils/productForm/formReducer';

export interface UsageDetailsSectionProps {
  draft: AddProductDraft;
  dispatch: (action: FormAction) => void;
}

const PAO_PRESETS = [3, 6, 12, 24] as const;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

/**
 * Section 4 — opening date and PAO. LOCAL ONLY: these fields never leave the
 * device (excluded from SuggestPayload by construction). The privacy note is
 * rendered once, by SaveBar — don't add a second copy here.
 */
export function UsageDetailsSection({ draft, dispatch }: UsageDetailsSectionProps) {
  const [customDateVisible, setCustomDateVisible] = useState(false);
  const [customPaoVisible, setCustomPaoVisible] = useState(false);
  const [customPaoText, setCustomPaoText] = useState('');

  const isPresetPao = draft.paoMonths !== null && (PAO_PRESETS as readonly number[]).includes(draft.paoMonths);
  const today = isoDaysAgo(0);
  const yesterday = isoDaysAgo(1);
  const lastWeek = isoDaysAgo(7);
  const isQuickDate =
    draft.openedDate === today || draft.openedDate === yesterday || draft.openedDate === lastWeek;

  function setOpenedDate(date: string) {
    setCustomDateVisible(false);
    dispatch({ type: 'SET_OPENED', isOpened: true, date });
  }

  function commitCustomPao(text: string) {
    const months = Number.parseInt(text, 10);
    if (Number.isInteger(months) && months > 0) {
      dispatch({ type: 'SET_PAO', months });
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Already opened?</Text>
          <Text style={styles.rowCaption}>Used for the expiry reminder</Text>
        </View>
        <Switch
          checked={draft.isOpened}
          onValueChange={(on: boolean) =>
            dispatch(
              on
                ? { type: 'SET_OPENED', isOpened: true, date: today }
                : { type: 'SET_OPENED', isOpened: false },
            )
          }
          size="md"
        />
      </View>

      {draft.isOpened ? (
        <View style={styles.quickRow}>
          <FilterChip selected={draft.openedDate === today} onPress={() => setOpenedDate(today)}>
            Today
          </FilterChip>
          <FilterChip
            selected={draft.openedDate === yesterday}
            onPress={() => setOpenedDate(yesterday)}
          >
            Yesterday
          </FilterChip>
          <FilterChip
            selected={draft.openedDate === lastWeek}
            onPress={() => setOpenedDate(lastWeek)}
          >
            Last week
          </FilterChip>
          <IconButton
            icon={
              <Feather
                name="calendar"
                size={14}
                color={
                  customDateVisible || (!isQuickDate && draft.openedDate !== null)
                    ? colors.textOnDark
                    : colors.textSecondary
                }
              />
            }
            label="Pick a custom opening date"
            size="xs"
            round
            onPress={() => setCustomDateVisible((v) => !v)}
            style={[
              styles.iconChip,
              (customDateVisible || (!isQuickDate && draft.openedDate !== null)) &&
                styles.iconChipSelected,
            ]}
          />
        </View>
      ) : null}

      {draft.isOpened && customDateVisible ? (
        <TextInput
          value={draft.openedDate ?? ''}
          onChangeText={(text) => dispatch({ type: 'SET_OPENED', isOpened: true, date: text })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          style={styles.input}
          accessibilityLabel="Date product was opened"
        />
      ) : null}

      <View style={styles.paoHeader}>
        <Feather name="clock" size={14} color={colors.textSecondary} />
        <Text style={styles.rowCaption}>
          Period after opening — look for the open jar symbol on the packaging.
        </Text>
      </View>

      <View style={styles.quickRow}>
        {PAO_PRESETS.map((months) => (
          <FilterChip
            key={months}
            selected={draft.paoMonths === months && !customPaoVisible}
            onPress={() => {
              setCustomPaoVisible(false);
              dispatch({ type: 'SET_PAO', months });
            }}
          >
            {`${months}M`}
          </FilterChip>
        ))}
        <FilterChip
          selected={customPaoVisible || (draft.paoMonths !== null && !isPresetPao)}
          onPress={() => setCustomPaoVisible((v) => !v)}
        >
          Custom
        </FilterChip>
      </View>

      {customPaoVisible ? (
        <TextInput
          value={customPaoText}
          onChangeText={(text) => {
            setCustomPaoText(text);
            commitCustomPao(text);
          }}
          placeholder="Months, e.g. 9"
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          maxLength={3}
          style={styles.input}
          accessibilityLabel="Custom period after opening in months"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  rowCaption: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  paoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[2],
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    backgroundColor: colors.surfaceRaised,
  },
  iconChip: {
    height: space[8],
    width: space[8],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipSelected: {
    backgroundColor: colors.controlFill,
    borderColor: colors.controlFill,
  },
});
