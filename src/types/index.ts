// ─── Active ingredients ───────────────────────────────────────────────────────

/**
 * Canonical keys mirror the class keys in src/constants/rulesets/actives.json.
 * Legacy keys ('retinol', 'vitamin_c', 'spf_chemical') remain valid for tags
 * persisted before the ruleset migration; getProductActiveKeys() normalizes
 * them to canonical keys via the ruleset's legacyKeyMap at read time.
 */
export type ActiveIngredientKey =
  // Canonical (actives.json classes)
  | 'retinoid'
  | 'aha'
  | 'bha'
  | 'pha'
  | 'vitamin_c_pure'
  | 'vitamin_c_derivative'
  | 'niacinamide'
  | 'benzoyl_peroxide'
  | 'azelaic_acid'
  | 'copper_peptides'
  | 'spf_filters'
  | 'ceramides'
  | 'hyaluronic_acid'
  | 'panthenol'
  | 'cica'
  // Legacy (pre-ruleset persisted tags, normalized on read)
  | 'retinol'
  | 'vitamin_c'
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

/** Key stored on a procedure log: a pre-defined procedure or a user-created one. */
export type ProcedureLogKey = CosmeticProcedureKey | 'custom';

/** Body zones a clinical procedure was applied to. */
export type TreatmentZone = 'face' | 'neck' | 'decollete';

export interface UserProcedureLog {
  id: string;
  procedureKey: ProcedureLogKey;
  /** User-provided display name; required when procedureKey is 'custom'. */
  customName?: string;
  /**
   * Recovery window in days for custom procedures, resolved from the symptom
   * presets (Light Care 0 / Redness 3 / Trauma 7) or manual input.
   * Pre-defined procedures read rehabDays from CLINICAL_RULES_DB instead.
   */
  customRehabDays?: number;
  /** Zones the procedure was applied to. Absent is treated as ['face']. */
  affectedZones?: TreatmentZone[];
  /**
   * Estimated next-repetition date in YYYY-MM-DD format; required when
   * procedureKey is 'custom'. Treated as the end-of-lifespan (0% efficiency)
   * baseline for the dynamic fading curve.
   */
  estimatedReturnDate?: string;
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

/**
 * Full Fitzpatrick scale (1–6). Derived from the grouped {@link SkinPhototype}
 * during migration and kept in sync by profileStore setters. The onboarding UI
 * flips to six visual cards in a later step; until then the grouped field
 * remains the authoritative input and this numeric field mirrors it.
 */
export type FitzpatrickType = 1 | 2 | 3 | 4 | 5 | 6;

/** Bundled city → coordinates entry used for weather-driven season masks. */
export interface CityLocation {
  name: string;
  lat: number;
  lon: number;
}

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
  /**
   * Grouped phototype (authoritative input while onboarding uses 3 cards).
   * Critical for laser/peel safety checks.
   */
  phototype: SkinPhototype | null;
  /**
   * Numeric Fitzpatrick scale mirror of {@link phototype}, added in schema v2.
   * Re-derived whenever phototype changes (see profileStore); consumed by the
   * routine engine's phototype modifiers.
   */
  fitzpatrick: FitzpatrickType | null;
  /** Selected city for weather-driven season masks; null until the user picks one. */
  city: CityLocation | null;
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
  /**
   * Set true by the schema-v2 migration when a legacy `vitamin_c` tag was
   * auto-mapped to `vitamin_c_pure`. Drives the product-detail infobox that
   * lets the user reclassify it as a derivative. Absence is treated as false.
   */
  vitaminCAutoMigrated?: boolean;
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
  /**
   * True when the user manually re-added a step the engine had frozen. The
   * routine engine preserves pinned steps except during an `avoid`-severity
   * clinical freeze. Defaulted to false by the schema-v2 migration; absence is
   * treated as false.
   */
  userPinned?: boolean;
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

// ─── Routine engine: rehab shield widget ──────────────────────────────────────

/**
 * State of the top-anchored rehabilitation widget on the Routines screen.
 * Derived per render from procedure logs — never persisted. Null when no
 * procedure has remaining rehab days (long-term effects like an active Botox
 * cycle never produce a widget; they live on the Clinic timeline only).
 */
export interface RehabWidgetState {
  procedureName: string;
  /** 1-based day inside the rehab window. */
  currentDay: number;
  totalDays: number;
  barrierStatus: 'disrupted' | 'sensitive';
  affectedZones: TreatmentZone[];
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * Routine cadence model. `fixed` maps actives to static weekdays (default,
 * zero tracking); `dynamic` opts into behaviour-driven 4-day skin cycling with
 * the "Complete My Routine" check-in.
 */
export type RoutineCycleType = 'fixed' | 'dynamic';

// ─── Tracking (dynamic cycling + adaptation) ──────────────────────────────────

/** Position in the fixed 4-night loop: exfoliation → retinoid → recovery ×2. */
export type CyclePhaseIndex = 0 | 1 | 2 | 3;

/**
 * Dynamic-cycling state machine (research §1.4). Driven by check-ins, not the
 * calendar: a missed night pauses the cycle (the uncompleted phase carries
 * forward), so the failure mode always degrades toward more recovery.
 */
export interface CycleState {
  cyclePhaseIndex: CyclePhaseIndex;
  /** Skincare date (YYYY-MM-DD) of the last check-in; null before the first. */
  lastAppliedDate: string | null;
}

/**
 * Per-product application counter driving the adaptation pipeline (research
 * §2.6). Incremented on check-in for every product visible in that day's
 * view; never decrements.
 */
export interface ProductApplicationStats {
  productId: string;
  count: number;
  /** Skincare date of the last counted application. */
  lastAppliedDate: string;
}

export interface AppSettings {
  gamificationEnabled: boolean;
  hasSeenLocalDataWarning: boolean;
  /** Keys of banners the user has permanently dismissed, e.g. 'banner_2026_summer'. */
  dismissedBanners: string[];
  /** Routine cadence model. Defaults to 'fixed'. */
  routineCycleType: RoutineCycleType;
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
