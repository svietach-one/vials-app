import { palette } from '@/constants/tokens';
import type { ActiveIngredientKey } from '@/types';

/**
 * Apothecary color grouping for the manual actives checklist and detected-
 * active chips (Section 3). Groups mirror the conflict-engine tag families;
 * "Soothing" is an informational grouping only — not part of the
 * ConflictEngine matrix, shown because it's equally common to check.
 */
export interface ActivesGroup {
  label: string;
  /** Group accent (dot, checked-chip text/border). */
  color: string;
  /** Checked-chip background. */
  tint: string;
  /** Checked-chip border. */
  line: string;
  keys: ActiveIngredientKey[];
}

export const ACTIVES_GROUPS: ActivesGroup[] = [
  {
    label: 'Retinoids',
    color: palette.amber,
    tint: palette.amberTint,
    line: palette.amberLine,
    keys: ['retinoid'],
  },
  {
    label: 'Acids',
    color: palette.amber,
    tint: palette.amberTint,
    line: palette.amberLine,
    keys: ['aha', 'bha', 'pha', 'azelaic_acid'],
  },
  {
    label: 'Vitamin C',
    color: palette.cobalt,
    tint: palette.cobaltTint,
    line: palette.cobaltLine,
    keys: ['vitamin_c_pure', 'vitamin_c_derivative'],
  },
  {
    label: 'Peptides',
    color: palette.bottleGreen,
    tint: palette.bottleGreenTint,
    line: palette.bottleGreenLine,
    keys: ['copper_peptides'],
  },
  {
    label: 'Soothing',
    color: palette.bottleGreen,
    tint: palette.bottleGreenTint,
    line: palette.bottleGreenLine,
    keys: ['niacinamide', 'panthenol', 'cica', 'ceramides'],
  },
];

/** Neutral fallback for OCR-detected keys outside the checklist groups (e.g. spf_filters). */
const FALLBACK_GROUP: ActivesGroup = {
  label: 'Other',
  color: palette.zinc600,
  tint: palette.zinc100,
  line: palette.zinc300,
  keys: [],
};

export function getGroupForKey(key: ActiveIngredientKey): ActivesGroup {
  return ACTIVES_GROUPS.find((group) => group.keys.includes(key)) ?? FALLBACK_GROUP;
}
