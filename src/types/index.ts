// ─── Active ingredients ───────────────────────────────────────────────────────

export type ActiveIngredientKey =
  | 'retinol'
  | 'aha'
  | 'bha'
  | 'vitamin_c'
  | 'niacinamide'
  | 'copper_peptides'
  | 'benzoyl_peroxide'
  | 'spf_chemical';

export interface ActiveIngredient {
  key: ActiveIngredientKey;
  displayName: string;
}

// ─── Clinical procedures ──────────────────────────────────────────────────────

export type CosmeticProcedureKey =
  | 'botox'
  | 'fillers'
  | 'smas_lifting'
  | 'mesotherapy'
  | 'chemical_peel_deep'
  | 'mechanical_facial';

export type ProcedureStatus = 'rehab' | 'active' | 'fading' | 'overdue' | 'archived';

export interface UserProcedureLog {
  id: string;
  procedureKey: CosmeticProcedureKey;
  /** Skincare date in YYYY-MM-DD format (day boundary at 04:00) */
  datePerformed: string;
  status: ProcedureStatus;
  /** How many times the user deferred the "fading?" prompt (cap: 3). */
  deferralCount: number;
  /** User-reported actual duration in months, set when they confirm fading. */
  realDuration?: number;
}

export interface ClinicalTimelineConfig {
  /** Phase 1: restrictions and SOS recovery window */
  rehabDays: number;
  /** Full cycle until the effect is considered gone */
  totalEffectMonths: number;
  /** Month when the fading counter begins (Phase 3) */
  fadeTriggerMonth: number;
}

export const CLINICAL_RULES_DB: Record<CosmeticProcedureKey, ClinicalTimelineConfig> = {
  botox: { rehabDays: 7, totalEffectMonths: 6, fadeTriggerMonth: 4 },
  fillers: { rehabDays: 14, totalEffectMonths: 12, fadeTriggerMonth: 10 },
  smas_lifting: { rehabDays: 14, totalEffectMonths: 18, fadeTriggerMonth: 14 },
  mesotherapy: { rehabDays: 5, totalEffectMonths: 6, fadeTriggerMonth: 5 },
  chemical_peel_deep: { rehabDays: 14, totalEffectMonths: 3, fadeTriggerMonth: 2 },
  mechanical_facial: { rehabDays: 3, totalEffectMonths: 1, fadeTriggerMonth: 1 },
};

// ─── Skin profile ─────────────────────────────────────────────────────────────

/** Fitzpatrick phototypes grouped for UX (no racial labels in UI) */
export type SkinPhototype = 'type_1_2' | 'type_3_4' | 'type_5_6';

export type SkinType = 'oily' | 'dry' | 'combination' | 'normal';

export type SkinConcern =
  | 'acne'
  | 'dryness'
  | 'wrinkles'
  | 'sensitivity'
  | 'redness'
  | 'eczema'
  | 'hyperpigmentation'
  | 'pores'
  | 'dark_spots';

export interface UserProfile {
  id: string;
  gender: 'female' | 'male' | null;
  age: number | null;
  skinType: SkinType | null;
  /** Critical for laser/peel safety checks */
  phototype: SkinPhototype | null;
  concerns: SkinConcern[];
  spfSensitivity: boolean;
  onboardingCompleted: boolean;
  /** Per-procedure duration overrides set when the user confirms actual fading. */
  individualDurationMonths: Partial<Record<CosmeticProcedureKey, number>>;
}

// ─── Products ─────────────────────────────────────────────────────────────────

export type ProductType =
  | 'cleanser'
  | 'toner'
  | 'essence'
  | 'serum'
  | 'gel'
  | 'moisturizer'
  | 'oil'
  | 'spf'
  | 'makeup_remover'
  | 'peeling'
  | 'ampoule'
  | 'lotion'
  | 'cream'
  | 'eye_cream'
  | 'mask'
  | 'balm'
  | 'spot_treatment'
  | 'other';

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  productType: ProductType;
  imageUrl: string | null;
  activeIngredients: ActiveIngredient[];
  /**
   * User-confirmed active ingredient keys, validated via the wizard checkbox step.
   * Used for reliable catalog filtering — never derived from raw OCR text at query time.
   * Undefined on products saved before this field was introduced; treat as [].
   */
  activeTags?: ActiveIngredientKey[];
  fullIngredientText: string | null;
  usageTime: 'morning' | 'evening' | 'both';
  openBeautyFactsId: string | null;
  addedAt: string;
  notes: string | null;
  /** ISO date string when the user first opened the product. Used for PAO expiry calculation. */
  openedDate: string | null;
  /** Period-After-Opening in months. Combined with openedDate to compute expiry. */
  paoMonths: number | null;
  /** Soft-hide flag. When true the product is excluded from routine step lists and rendered dimmed in the catalog. Absence is treated as false. */
  isHidden?: boolean;
}

// ─── Routine target ───────────────────────────────────────────────────────────

export type RoutineTarget = 'none' | 'morning' | 'evening' | 'both';

// ─── Routines ─────────────────────────────────────────────────────────────────

export interface RoutineStep {
  id: string;
  productType: ProductType;
  productId: string | null;
  hidden: boolean;
  /**
   * Days of the week this step is active. 0 = Sunday … 6 = Saturday.
   * An empty array means "every day" (default behaviour).
   */
  scheduledDays: number[];
}

export interface Routine {
  id: string;
  name: string;
  timeOfDay: 'morning' | 'evening';
  steps: RoutineStep[];
}

// ─── Ingredient conflicts ─────────────────────────────────────────────────────

export type ConflictSeverity = 'avoid' | 'caution';

/** Union of active ingredient keys and cosmetic procedure keys used in conflict rules */
export type TargetEventKey = ActiveIngredientKey | CosmeticProcedureKey;

export interface ConflictRule {
  id: string;
  itemA: TargetEventKey;
  itemB: TargetEventKey;
  severity: ConflictSeverity;
  explanation: string;
  suggestion: string;
}

export interface ProcedureCollisionRule {
  itemA: CosmeticProcedureKey;
  itemB: CosmeticProcedureKey;
  severity: ConflictSeverity;
  explanation: string;
  suggestion: string;
}

export interface ConflictResult {
  stepIdA: string;
  stepIdB: string;
  rule: ConflictRule;
}

export interface ClinicalConflictResult {
  severity: ConflictSeverity;
  explanation: string;
  suggestion: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  gamificationEnabled: boolean;
  hasSeenLocalDataWarning: boolean;
  /** Keys of banners the user has permanently dismissed, e.g. 'banner_2026_summer'. */
  dismissedBanners: string[];
}

// ─── Catalog filters ──────────────────────────────────────────────────────────

export type CategoryFilter = 'All' | ProductType;
export type BiomarkerTag = 'Soothing' | 'Actives' | 'Hydration';

export interface CatalogFilterState {
  searchQuery: string;
  selectedCategory: CategoryFilter;
  selectedBiomarkers: BiomarkerTag[];
}

export const CATALOG_FILTER_DEFAULT: CatalogFilterState = {
  searchQuery: '',
  selectedCategory: 'All',
  selectedBiomarkers: [],
};
