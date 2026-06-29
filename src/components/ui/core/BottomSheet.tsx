import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { IconButton } from '@/components/ui/core/IconButton';
import { colors, radius, space } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * When provided, renders a titled header row with a close (X) button.
   * The drag handle is hidden when a title is present.
   */
  title?: string;
  /**
   * Whether tapping the semi-transparent backdrop closes the sheet.
   * Defaults to true. Set to false for forms where accidental dismissal loses work.
   */
  dismissOnBackdrop?: boolean;
  /** Additional styles applied to the white sheet surface (e.g. custom padding). */
  contentStyle?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomSheet({
  visible,
  onClose,
  children,
  title,
  dismissOnBackdrop = true,
  contentStyle,
}: BottomSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismissOnBackdrop ? onClose : () => {}}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={dismissOnBackdrop ? onClose : undefined}
      >
        {/* onStartShouldSetResponder prevents backdrop tap events from
            passing through to the sheet surface */}
        <View style={[styles.sheet, contentStyle]} onStartShouldSetResponder={() => true}>
          {title ? (
            <View style={styles.header}>
              <View style={styles.headerSpacer} />
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              <View style={styles.headerClose}>
                <IconButton
                  icon={<Feather name="x" size={18} color={colors.textSecondary} />}
                  label="Close"
                  variant="ghost"
                  size="sm"
                  onPress={onClose}
                />
              </View>
            </View>
          ) : (
            <View style={styles.handle} />
          )}
          {children}
        </View>
      </Pressable>
    </Modal>
  );
}

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
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[8],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: space[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: space[2],
    paddingBottom: space[4],
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  headerClose: {
    width: 44,
    alignItems: 'flex-end',
  },
});
