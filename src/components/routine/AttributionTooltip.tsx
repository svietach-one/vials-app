import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { IconButton } from '@/components/ui/core/IconButton';
import { colors, radius, space, typography } from '@/constants/tokens';
import { getAliasMicroCopy } from '@/utils/attributionLookup';
import type { MatchedToken } from '@/utils/ingredientParser';

export interface AttributionTooltipProps {
  visible: boolean;
  onClose: () => void;
  /** Canonical active-class label, e.g. "BHA (Salicylic Acid)". */
  displayName: string;
  matches: MatchedToken[];
}

const GENERIC_FALLBACK_COPY =
  "This ingredient was detected from the product's ingredient list.";

export function AttributionTooltip({ visible, onClose, displayName, matches }: AttributionTooltipProps) {
  if (!visible) return null;

  return (
    <View style={styles.root} testID="attribution-tooltip">
      <Pressable
        testID="attribution-tooltip-backdrop"
        style={styles.backdrop}
        onPress={onClose}
      />

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.header} testID="attribution-tooltip-header">
            {displayName}
          </Text>
          <IconButton
            testID="attribution-tooltip-close"
            icon={<Feather name="x" size={18} color={colors.textSecondary} />}
            label="Close"
            variant="ghost"
            size="sm"
            onPress={onClose}
          />
        </View>

        {matches.length === 0 ? (
          <Text testID="attribution-no-matches" style={styles.copy}>
            {GENERIC_FALLBACK_COPY}
          </Text>
        ) : (
          <ScrollView style={styles.matchList}>
            {matches.map((match, index) => {
              const overrideCopy = getAliasMicroCopy(match);
              return (
                <View
                  key={`${match.matcherPattern}-${index}`}
                  testID={`attribution-match-${index}`}
                  style={styles.matchRow}
                >
                  <Text testID={`attribution-match-text-${index}`} style={styles.matchText}>
                    {`Matched: "${match.rawText}"`}
                  </Text>
                  <Text testID={`attribution-match-copy-${index}`} style={styles.copy}>
                    {overrideCopy ?? GENERIC_FALLBACK_COPY}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 9, 11, 0.5)',
  },
  card: {
    backgroundColor: colors.bgBase,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space[5],
    paddingTop: space[5],
    paddingBottom: space[8],
    gap: space[3],
    maxHeight: '70%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
  },
  header: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  matchList: {
    gap: space[3],
  },
  matchRow: {
    gap: space[1],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
  },
  matchText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  copy: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
