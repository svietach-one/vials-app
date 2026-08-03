import React, { useState } from 'react';

import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { Switch } from '@/components/ui/forms/Switch';
import { SkinConcernsSelector } from '@/components/profile/SkinConcernsSelector';
import { PREGNANCY_HINT, PREGNANCY_LABEL } from '@/constants/labels';
import type { SkinConcern, SkinConditionType, UserProfile } from '@/types';
import { StepLayout } from './StepLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdditionalInfoStepProps {
  initialPregnantOrBreastfeeding: boolean;
  initialSkinConditions: SkinConditionType[];
  initialConcerns: SkinConcern[];
  onNext: (patch: Partial<UserProfile>) => void;
  onSkip: () => void;
  onBack: () => void;
  /** The container's OnboardingProgressRing, forwarded into the header row next to Back. */
  progressRing?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

/** Step 5 of 5 — anything we should know. Always the last step; footer reads "Finish". */
export function AdditionalInfoStep({
  initialPregnantOrBreastfeeding,
  initialSkinConditions,
  initialConcerns,
  onNext,
  onSkip,
  onBack,
  progressRing,
}: AdditionalInfoStepProps) {
  const [pregnantOrBreastfeeding, setPregnantOrBreastfeeding] = useState(
    initialPregnantOrBreastfeeding,
  );
  const [skinConditions, setSkinConditions] = useState<SkinConditionType[]>(initialSkinConditions);
  const [concerns, setConcerns] = useState<SkinConcern[]>(initialConcerns);

  return (
    <StepLayout
      title="Anything we should know?"
      subtitle="Select anything that applies. This helps us avoid ingredients or procedures that may not be right for your skin."
      onBack={onBack}
      onSkip={onSkip}
      onNext={() => onNext({ pregnantOrBreastfeeding, skinConditions, concerns })}
      nextLabel="Finish"
      progressRing={progressRing}
    >
      <InlineAlert
        tone="warning"
        title={PREGNANCY_LABEL}
        action={
          <Switch
            checked={pregnantOrBreastfeeding}
            onValueChange={setPregnantOrBreastfeeding}
            accessibilityLabel={PREGNANCY_LABEL}
          />
        }
      >
        {PREGNANCY_HINT}
      </InlineAlert>

      <SkinConcernsSelector
        concerns={concerns}
        skinConditions={skinConditions}
        onChangeConcerns={setConcerns}
        onChangeConditions={setSkinConditions}
      />
    </StepLayout>
  );
}
