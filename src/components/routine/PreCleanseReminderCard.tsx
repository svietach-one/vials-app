import React from 'react';
import { Feather } from '@expo/vector-icons';

import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { colors } from '@/constants/tokens';
import type { PreCleanseReminder } from '@/utils/routineEngine/preCleanseReminder';

/**
 * Mini notification card — not an inline note on the product's own card
 * (RoutineStepCard no longer renders a stepNote). Rendered by the caller
 * directly under the flagged makeup-remover/micellar-water step's own row
 * (RoutinesScreen matches `reminder.stepId` against each step it renders),
 * so it reads as commentary on that specific step rather than a page-level
 * banner. The reminder itself is computed once by the caller (see
 * findPreCleanseReminder) — live against the currently saved evening
 * routine, so it never goes stale after a manual edit the way the
 * generation-time `stepNote` field can.
 *
 * Tone is "info" (blue) — this is guidance, not an error, so it reads calmer
 * than the amber rehab alarms. (It could once have vanished when the Evening
 * accordion background was itself `palette.cobaltTint`, but that background is
 * now white, so the blue tint reads clearly.)
 */
export interface PreCleanseReminderCardProps {
  reminder: PreCleanseReminder;
}

export function PreCleanseReminderCard({ reminder }: PreCleanseReminderCardProps) {
  return (
    <InlineAlert
      tone="info"
      icon={<Feather name="info" size={14} color={colors.statusInfo} />}
    >
      {`${reminder.productName} isn't followed by a cleanser — micellar water/makeup remover shouldn't stay on skin.`}
    </InlineAlert>
  );
}
