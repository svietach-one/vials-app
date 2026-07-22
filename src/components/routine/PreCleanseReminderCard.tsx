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
 * Tone is "warning" (amber), not "info" — pre_cleanse steps are PM-only, and
 * "info"'s blue tint (`colors.statusInfoTint`) is the exact same token as the
 * Evening card's own background (`palette.cobaltTint`), so it would nearly
 * disappear there. Amber contrasts against both the Morning (pale yellow) and
 * Evening (pale blue) card colors.
 */
export interface PreCleanseReminderCardProps {
  reminder: PreCleanseReminder;
}

export function PreCleanseReminderCard({ reminder }: PreCleanseReminderCardProps) {
  return (
    <InlineAlert
      tone="warning"
      icon={<Feather name="alert-circle" size={14} color={colors.statusWarning} />}
    >
      {`${reminder.productName} isn't followed by a cleanser — micellar water/makeup remover shouldn't stay on skin.`}
    </InlineAlert>
  );
}
