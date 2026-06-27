import { useEffect } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { useRoutinesStore } from '@/store/routinesStore';
import type { Product } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  product: Product;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RemoveRoutineActionSheet({ visible, product, onClose }: Props) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!visible) return;

    const { routines } = useRoutinesStore.getState();
    const matches = routines
      .filter((r) => r.steps.some((s) => s.productId === product.id))
      .map((r) => ({
        routineId: r.id,
        label: r.timeOfDay === 'morning' ? 'Morning' : 'Evening',
      }));

    if (matches.length === 0) {
      onClose();
      return;
    }

    function doRemove(routineId: string) {
      useRoutinesStore.getState().removeProductStep(routineId, product.id);
    }

    if (matches.length >= 2) {
      const [first, second] = matches;
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: product.name,
            options: [
              `Remove from ${first.label} Routine`,
              `Remove from ${second.label} Routine`,
              'Remove from All Routines',
              'Cancel',
            ],
            destructiveButtonIndex: 2,
            cancelButtonIndex: 3,
          },
          (index) => {
            if (index === 0) doRemove(first.routineId);
            else if (index === 1) doRemove(second.routineId);
            else if (index === 2) {
              doRemove(first.routineId);
              doRemove(second.routineId);
            }
            onClose();
          },
        );
      } else {
        Alert.alert(
          product.name,
          'Choose which routine to remove it from:',
          [
            {
              text: `Remove from ${first.label}`,
              onPress: () => { doRemove(first.routineId); onClose(); },
            },
            {
              text: `Remove from ${second.label}`,
              onPress: () => { doRemove(second.routineId); onClose(); },
            },
            {
              text: 'Remove from All',
              style: 'destructive',
              onPress: () => { doRemove(first.routineId); doRemove(second.routineId); onClose(); },
            },
            { text: 'Cancel', style: 'cancel', onPress: onClose },
          ],
        );
      }
    } else {
      const [match] = matches;
      Alert.alert(
        'Remove from Routine?',
        `Remove ${product.name} from your ${match.label} routine?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: onClose },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => { doRemove(match.routineId); onClose(); },
          },
        ],
      );
    }
  }, [visible]);

  return null;
}
