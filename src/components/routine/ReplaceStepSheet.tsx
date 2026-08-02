import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/core/IconButton';
import { ProductThumbnail } from '@/components/ui/ProductThumbnail';
import { Tag } from '@/components/ui/core/Tag';
import {
  selectToneColor,
  type SelectOption,
  type SelectOptionTone,
} from '@/components/ui/forms/Select';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
import type { Product } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Everything the sheet needs to render one step's replacement picker. Built by
 * DraftPreviewScreen when the user taps "Change" on a step and cleared on
 * dismiss — the sheet never derives candidates itself, so it stays a pure
 * presentation of an already-ranked list (buildStepOptions in the screen).
 */
export interface ReplaceStepTarget {
  /**
   * The slot's stable identity key (never the currently-admitted product), so
   * repeated reselection keeps resolving to the same slot — see planApply.ts.
   */
  winnerProductId: string;
  /** Human slot label, e.g. "Cleanser" — drives the "Select Cleanser" title. */
  categoryLabel: string;
  /** Pre-ranked candidates: current first, then recommended, then reserve. */
  options: SelectOption[];
  /** The product currently occupying the slot — gets the "Current" badge. */
  currentProductId: string;
}

export interface ReplaceStepSheetProps {
  target: ReplaceStepTarget | null;
  onClose: () => void;
  productOf: (productId: string | null) => Product | undefined;
  /** Fired with the chosen candidate's product id; the screen maps it to a swap. */
  onSelect: (chosenProductId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * The replacement picker (screen-2 of the routine-draft redesign): a bottom
 * sheet, opened from a step's "Change" affordance, listing every recorded
 * same-slot candidate as a radio row. Choosing one bubbles up to
 * DraftPreviewScreen, which rewrites the still-uncommitted draft — the sheet
 * never mutates anything itself.
 *
 * Built on a plain RN `Modal` (the RemoveStepModal / DuplicateSlotChoiceSheet
 * pattern) rather than a nested @gorhom/bottom-sheet: DraftPreviewScreen is
 * itself a BottomSheetModal, and nesting a second one inside it makes gorhom's
 * default `stackBehavior="switch"` dismiss the parent on present — which
 * cascades back through onDismiss and slams this sheet shut a frame after it
 * opens. An RN Modal renders in its own window above the parent, no stack.
 *
 * Candidates are split into "Recommended for you" (always and only the
 * engine's original pick for this slot, `winnerProductId`) and "Good
 * alternatives" (everything else, including the product currently in the
 * slot when the user has already swapped away from the recommendation — it
 * keeps its "Current" tag there, but the "Recommended for you" label stays
 * pinned to the engine's pick and never follows a manual swap).
 */
export function ReplaceStepSheet({ target, onClose, productOf, onSelect }: ReplaceStepSheetProps) {
  const insets = useSafeAreaInsets();

  // Split candidates into the two reference sections. Gated on `target` so no
  // rows exist in the tree until a step is actually tapped.
  const recommended = target
    ? target.options.filter((o) => o.value === target.winnerProductId)
    : [];
  const alternatives = target
    ? target.options.filter((o) => o.value !== target.winnerProductId)
    : [];

  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        {/* Stop propagation so tapping inside the sheet never closes it. */}
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + space[4] }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.grabber} />

          {target ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title} numberOfLines={1}>
                  {`Select ${target.categoryLabel}`}
                </Text>
                <IconButton
                  icon={<Icon name="x" size={18} color={colors.textSecondary} />}
                  label="Close"
                  variant="secondary"
                  size="sm"
                  onPress={onClose}
                />
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
              >
                {recommended.length > 0 ? (
                  <Section label="Recommended for you">
                    {recommended.map((option) => (
                      <OptionRow
                        key={option.value}
                        option={option}
                        product={productOf(option.value)}
                        isCurrent={option.value === target.currentProductId}
                        selected={option.value === target.currentProductId}
                        onPress={() => onSelect(option.value)}
                      />
                    ))}
                  </Section>
                ) : null}

                {alternatives.length > 0 ? (
                  <Section label="Good alternatives">
                    {alternatives.map((option) => (
                      <OptionRow
                        key={option.value}
                        option={option}
                        product={productOf(option.value)}
                        isCurrent={option.value === target.currentProductId}
                        selected={option.value === target.currentProductId}
                        onPress={() => onSelect(option.value)}
                      />
                    ))}
                  </Section>
                ) : null}
              </ScrollView>
            </>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      <View style={styles.sectionList}>{children}</View>
    </View>
  );
}

// ─── One candidate row ────────────────────────────────────────────────────────

function OptionRow({
  option,
  product,
  isCurrent,
  selected,
  onPress,
}: {
  option: SelectOption;
  product: Product | undefined;
  isCurrent: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.optionRow,
        selected && styles.optionRowSelected,
        pressed && styles.optionRowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={option.reason ? `${option.title} — ${option.reason}` : option.title}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>

      {product ? <ProductThumbnail product={product} size={52} /> : null}

      <View style={styles.optionText}>
        <Text style={styles.optionTitle} numberOfLines={2}>
          {option.title}
        </Text>
        {product?.brand ? (
          <Text style={styles.optionBrand} numberOfLines={1}>
            {product.brand}
          </Text>
        ) : null}
        {isCurrent ? (
          <Tag tone="neutral" style={styles.currentTag}>
            Current
          </Tag>
        ) : option.reason ? (
          <Text style={[styles.optionReason, { color: toneColorOf(option.tone) }]} numberOfLines={1}>
            {option.reason}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const toneColorOf = (tone: SelectOptionTone | undefined) => selectToneColor[tone ?? 'neutral'];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,9,11,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgBase,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space[2],
    paddingHorizontal: space.gutterScreen,
    maxHeight: '85%',
    ...shadow.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: space[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space[3],
    gap: space[3],
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    gap: space[5],
    paddingTop: space[1],
  },
  section: {
    gap: space[2],
  },
  sectionLabel: {
    ...typography.caption,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textTertiary,
  },
  sectionList: {
    gap: space[1],
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
    paddingHorizontal: space[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    backgroundColor: colors.bgBase,
  },
  optionRowSelected: {
    borderColor: palette.plum,
    backgroundColor: palette.plumTintLight,
  },
  optionRowPressed: {
    backgroundColor: palette.plumTintLight,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: palette.plum,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.plum,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  optionBrand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  optionReason: {
    ...typography.caption,
    fontSize: 12,
  },
  currentTag: {
    alignSelf: 'flex-start',
    marginTop: space[1],
  },
});
