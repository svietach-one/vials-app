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
  | 'peptide_signal'
  | 'peptide_neuro'
  | 'spf_filters'
  | 'ceramides'
  | 'hyaluronic_acid'
  | 'glycerin_class'
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

/** Functional grouping used to color-code active-ingredient badges on the shelf card. */
export type ActiveBadgeCategory = 'exfoliant' | 'soothing' | 'hydrator' | 'other';

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

/**
 * The user's care goal — what the routine is built FOR (V2.1 pipeline
 * Step 0). Distinct from {@link SkinConcern}: concerns are symptoms the user
 * reports; a goal is the single treatment direction the engine optimizes.
 * 'maintenance' means no problem to solve — the treatment slot stays empty.
 */
export type SkinGoal =
  | 'acne'
  | 'pigmentation'
  | 'aging'
  | 'dehydration'
  | 'barrier_repair'
  | 'oil_control'
  | 'maintenance';

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
  /**
   * Primary care goal driving treatment selection (V2.1 Step 0). Defaults to
   * 'maintenance'; heuristically derived from concerns for pre-goal profiles.
   */
  primaryGoal: SkinGoal;
  /** Optional second goal; at most 2 goals total. */
  secondaryGoal: SkinGoal | null;
  /** True when goals were derived rather than user-chosen — one-time confirm prompt. */
  goalNeedsConfirmation: boolean;
  /**
   * True when `fitzpatrick` was auto-derived from a grouped phototype during a
   * migration rather than chosen on the 6-card selector (V2.1 phase-08) — a
   * one-time "confirm your skin tone" prompt. The engine keeps using the
   * conservatively-derived value until confirmed.
   */
  phototypeNeedsConfirmation: boolean;
  spfSensitivity: boolean;
  onboardingCompleted: boolean;
  /** Per-procedure duration overrides set when the user confirms actual fading. */
  individualDurationMonths: Partial<Record<CosmeticProcedureKey, number>>;
  /**
   * Whether the user has agreed to include their product photo in community
   * contributions (GDPR Art. 7(4) consent), and when that choice was last
   * made. `timestamp === null` means the choice predates this feature
   * (migrated install) and the user has never been asked. See
   * `src/utils/contributionConsent.ts` for the gating helper.
   */
  contributionConsent: ContributionConsent;
}

/** Consent to share a product photo in community contributions (schema v4). */
export interface ContributionConsent {
  granted: boolean;
  /** ISO timestamp of the last choice, or null if never explicitly made. */
  timestamp: string | null;
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

/**
 * Product provenance — mirrors the server (Turso) products.source enum
 * (db-product-spec.md §4.1) so values round-trip on sync. Locally created
 * records use 'user_local' (manual entry) or 'obf_import' (added from an
 * Open Beauty Facts result); 'vials_seed' / 'community' arrive via the
 * community-DB pull pipeline.
 */
export type ProductSource = 'vials_seed' | 'obf_import' | 'community' | 'user_local';

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
  /** EAN/UPC barcode scanned during add flow. Null when skipped or entered manually. */
  barcode?: string | null;
  /**
   * Provenance split (OBF import vs manual entry vs community sync).
   * Backfilled by migrateProducts for records persisted before this field:
   * openBeautyFactsId set → 'obf_import', otherwise 'user_local'.
   */
  source?: ProductSource;
  /** Soft-hide flag. When true the product is excluded from routine step lists and rendered dimmed in the catalog. Absence is treated as false. */
  isHidden?: boolean;
  /**
   * Set true by the schema-v2 migration when a legacy `vitamin_c` tag was
   * auto-mapped to `vitamin_c_pure`. Drives the product-detail infobox that
   * lets the user reclassify it as a derivative. Absence is treated as false.
   */
  vitaminCAutoMigrated?: boolean;
  /**
   * Device-local, user-attached product photo — a `file://` path inside the
   * app document directory (img-01). Distinct from {@link imageUrl}, which is
   * server-owned and round-trips on sync. This path is meaningless off-device
   * and MUST NEVER enter an outbound payload: a contribution carries photo
   * BYTES (EXIF-stripped, see renderContributionBlob), never a device path.
   * Same local-only firewall as openedDate / paoMonths. Absent on records
   * saved before this field.
   *
   * Render precedence everywhere: `localImageUri ?? imageUrl ?? <placeholder>`.
   */
  localImageUri?: string | null;
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
  /**
   * Contextual instruction attached at plan generation (e.g. a pre-cleanse
   * step followed by a cleanser) — not a step type, no completion tracking of
   * its own. `null`/absent = no note. Set on save from `PlannedStep.stepNote`;
   * manual edits leave it as-is until the next regeneration overwrites it.
   */
  stepNote?: string | null;
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

// ─── Routine engine: rehab notice ─────────────────────────────────────────────

/**
 * One merged rehab notification card (Routines screen). Consolidates the old
 * separate rehab shield + lifestyle-restrictions cards into a single card per
 * procedure — two cards about the same procedure read as needlessly anxious.
 * Procedures sharing identical restrictions AND timeframe are merged into one
 * notice (procedureName joined with " + "). `restrictions` is populated only
 * during the acute (disrupted) phase and drops to [] once the barrier is
 * merely sensitive, so the card's body shrinks as the relevance passes.
 * Derived per render from procedure logs; never persisted.
 */
export interface RehabNotice {
  /** Stable list key — the merged procedures' ids joined with "+". */
  key: string;
  procedureName: string;
  /** 1-based day inside the rehab window. */
  currentDay: number;
  totalDays: number;
  barrierStatus: 'disrupted' | 'sensitive';
  restrictions: string[];
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
  /**
   * Skincare date of the FIRST counted application (V2.1 phase-05 usage
   * anchor). Null for pre-phase-5 stats; the virtual count then anchors on the
   * product's first scheduled date instead of its shelf-add date.
   */
  firstAppliedDate: string | null;
}

export interface AppSettings {
  gamificationEnabled: boolean;
  hasSeenLocalDataWarning: boolean;
  /** Keys of banners the user has permanently dismissed, e.g. 'banner_2026_summer'. */
  dismissedBanners: string[];
  /** Routine cadence model. Defaults to 'fixed'. */
  routineCycleType: RoutineCycleType;
  /**
   * Local, per-device count of community contributions (barcode scans /
   * ingredient submissions). An encouragement signal only — no synced
   * endpoint backs a global number in this scope.
   */
  communityContributionCount: number;
}

// ─── Catalog filters ──────────────────────────────────────────────────────────

export type CategoryFilter = 'All' | ProductType;

/** "What it does" taxonomy for the My Shelf filter sheet, matched against `Product.activeTags`. */
export type FunctionalBenefit =
  | 'hydration'
  | 'exfoliation'
  | 'soothing'
  | 'anti_acne'
  | 'barrier_repair'
  | 'brightening';

export interface CatalogFilterState {
  searchQuery: string;
  selectedCategory: CategoryFilter;
  selectedBenefits: FunctionalBenefit[];
}

export const CATALOG_FILTER_DEFAULT: CatalogFilterState = {
  searchQuery: '',
  selectedCategory: 'All',
  selectedBenefits: [],
};

// ─── Add Product wizard ───────────────────────────────────────────────────────

/** Which capture flow the shared camera modal runs. */
export type CaptureMode = 'label' | 'barcode' | 'inci';

/** Draft state for the accordion Add Product screen. Never persisted as-is. */
export interface AddProductDraft {
  // Section 1 — brand, name, category
  brand: string;
  brandSource: 'ocr' | 'autocomplete' | 'typed' | null;
  name: string;
  nameSource: 'ocr' | 'typed' | null;
  productType: ProductType | null;
  productTypeSource: 'auto-detected' | 'manual' | null;

  // Section 2 — barcode
  barcode: string | null; // null = skipped, never blocks progress

  // Section 3 — ingredients
  inciRaw: string | null; // full raw text, present only if OCR/paste used
  activeIngredientKeys: ActiveIngredientKey[]; // deduped
  ingredientsSource: 'ocr' | 'checklist' | 'mixed';
  /**
   * Subset of activeIngredientKeys that came from OCR/paste parsing, so
   * clearing the raw text removes exactly these and preserves manual
   * checklist picks. Pruned when the user removes a key by hand.
   */
  ocrDerivedKeys: ActiveIngredientKey[];

  // Section 4 — usage details. LOCAL ONLY. Never leaves the device.
  isOpened: boolean;
  openedDate: string | null; // ISO 8601, set only if isOpened
  paoMonths: number | null;

  // Meta
  sectionStatus: {
    brand: 'empty' | 'in-progress' | 'complete';
    barcode: 'empty' | 'skipped' | 'complete';
    ingredients: 'empty' | 'in-progress' | 'complete';
    usage: 'empty' | 'complete';
  };
  expandedSection: 1 | 2 | 3 | 4 | null;
}

/** Data returned from the camera modal to the launching section. */
export type CaptureResult =
  | { mode: 'label'; rawText: string }
  | { mode: 'barcode'; code: string }
  /** hadNonLatin: ocrTextCleaner stripped a significant non-Latin share. */
  | { mode: 'inci'; rawText: string; hadNonLatin: boolean };

/**
 * Background-suggest payload. Structurally distinct from Product —
 * deliberately NOT an Omit<Product, ...> alias: this is the enforcement
 * point that keeps local-only fields (openedDate, paoMonths) from ever
 * leaking into a server payload, even if Product gains new personal
 * fields later.
 */
export interface SuggestPayload {
  brand: string;
  name: string;
  productType: ProductType;
  barcode: string | null;
  inciRaw: string | null;
  status: 'pending';
}
