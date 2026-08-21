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
  /**
   * Abrasive-particle signal, sourced ONLY from `Product.isPhysicalExfoliant`
   * — never derived from INCI text (tech-design vials-conflict-matrix-
   * expansion.md §3 FE-1/FE-2). The corresponding `actives.json` class is
   * deliberately matcher-less (FE-3): an ingredient label can never, on its
   * own, cause this key to be attributed to a product.
   */
  | 'physical_exfoliant'
  /**
   * Pregnancy-restricted skin-lightening agent (ACOG/AAD-consensus tier,
   * engine4.1 handoff §4). Not wired into `actives.json`'s `goals` block —
   * this class exists so the pregnancy freeze can see it, not to compete for
   * treatment-slot selection.
   */
  | 'hydroquinone'
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

/**
 * Non-conflict, presence-only ingredient groups consumed by the recommendation
 * layer only (PRD v1.2 §5.2). Deliberately a SEPARATE key space from
 * {@link ActiveIngredientKey}: barrier tags must never reach the pairwise
 * conflict matrix or an ActiveIngredientKey[] array. See
 * src/utils/barrierTags.ts for the parser.
 */
export type BarrierIngredientKey =
  | 'CERA' // Ceramides
  | 'PANT' // Panthenol
  | 'GLYC' // Glycerin / humectant glycols
  | 'NIAC' // Niacinamide
  | 'ZPCA' // Zinc PCA
  | 'HYAL'; // Hyaluronic acid / sodium hyaluronate

/**
 * Ordered three-level advisory scale (PRD v1.2 §5.2) used by the v1.2
 * recommendation layers — condition modifiers and density insights — only.
 *
 * The production conflict matrix keeps its own two-level
 * {@link ConflictSeverity} ('caution' | 'avoid') and is NEVER rewritten to this
 * scale. The two meet at one documented projection in
 * src/utils/skinConditionModifiers.ts (`caution` ↔ medium, `avoid` ↔ high), so
 * a one-level escalation of a rendered pairwise conflict means
 * caution → avoid, and an `avoid` pair renders unchanged (capped).
 */
export type AdvisorySeverity = 'low' | 'medium' | 'high';

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
  /** Free-text note the user attached to this procedure (Clinic → Details). */
  note?: string;
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

/**
 * Optional, self-reported skin conditions (PRD v1.2 §4.2.2, US-23). Presence
 * only — no severity level in v1, and NOT a diagnosis. Deliberately kept
 * separate from {@link SkinConcern} (which shares an `eczema` member): concerns
 * are symptoms the user reports to steer product selection, conditions are risk
 * modifiers that make existing warnings more conservative and never more
 * permissive. Whether the two should be merged is an open product question
 * (PRD §5.1) — until it is answered, nothing derives one from the other.
 */
export type SkinConditionType = 'eczema' | 'seborrheic_dermatitis' | 'rosacea';

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
   * Grouped phototype, derived from the numeric {@link fitzpatrick} the
   * 6-card onboarding selector writes (see `deriveGroupedPhototype`).
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
   * Self-reported skin conditions (v1.2, US-23). Default `[]` — an empty list
   * is the guaranteed no-op state (US-27): every v1.2 condition layer returns
   * an empty result and the engine behaves exactly as it did before the
   * feature shipped.
   */
  skinConditions: SkinConditionType[];
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
  /**
   * Self-reported skin sensitivity — reacts easily to new products/actives,
   * added in schema v7. Independent of `skinType`. Reachable both via
   * `SkinTypeQuizSheet`'s Quiz B (B4) and a direct manual control (parity
   * with `hormoneTherapy`/`pregnantOrBreastfeeding`/`spfSensitivity`). Also
   * the field `Product.isPhysicalExfoliant`'s docstring forward-references.
   */
  sensitive: boolean;
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
  /**
   * Currently on hormone therapy (gender-affirming or otherwise), added in
   * schema v6. Collected for future personalization (sebum/sensitivity
   * weighting) — no downstream logic reads it yet.
   */
  hormoneTherapy: boolean;
  /**
   * Pregnant or breastfeeding, added in schema v6. Safety-relevant flag for
   * a planned conflict-engine check (retinoids / high-concentration acids)
   * and a clinic-procedure block — both separate, not-yet-built follow-ups.
   */
  pregnantOrBreastfeeding: boolean;
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

/** My Shelf's two entities — see docs/tasks/ux-explore-vials/01-entry-points.md §0. */
export type ProductStatus = 'owned' | 'wishlist';

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
  /**
   * Labelled sun protection factor, only meaningful when
   * `productType === 'spf'` (v1.2, US-29). Optional by design: `null` /
   * absent means "unknown", which the SPF adequacy check treats as "can't
   * check", never as "assume the worst".
   */
  spfValue?: number | null;
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
   * My Shelf status — 'owned' (physically in use, feeds routine/PAO/conflict
   * logic) or 'wishlist' (considering, no inventory side effects). Absent is
   * treated as 'owned', same convention as isHidden — every record saved
   * before Wishlist existed is implicitly on-shelf.
   */
  status?: ProductStatus;
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
  /**
   * Whether the user explicitly opted in to sharing THIS product with the
   * Vials product database at save time (see docs/specs/contribution-consent-flow/).
   * Set once at save and never mutated afterward — the running contributor
   * counter reads this field directly, independent of the user's current
   * global `contributionConsentStatus`. Absent on records saved before this
   * field existed; treat as false.
   */
  contributionOptIn?: boolean;
  /**
   * User-asserted "this product physically abrades the skin" signal (a
   * scrub, an exfoliating cleansing tool) — orthogonal to `productType`, the
   * same relationship the `sensitive` profile flag has to skin type. Never
   * derived from `fullIngredientText`: abrasive particles generally do not
   * show up in an ingredient list the way a chemical active does. Absent on
   * records saved before this field; treat as false. Drives the
   * `physical_exfoliant` key in {@link ActiveIngredientKey} via
   * `getProductActiveKeys` (tech-design vials-conflict-matrix-expansion.md).
   */
  isPhysicalExfoliant?: boolean;
  /**
   * Cached result of the last EU fragrance-allergen scan of
   * `fullIngredientText` (tech-design vials-eu-allergen-detection.md FE-2/
   * FE-3). Only trustworthy when {@link allergenListVersion} equals the
   * bundled seed's current `list_version` — `getProductAllergenMatches`
   * recomputes live otherwise, so a JSON swap (26→82 substances) or a
   * pre-existing product without this field both self-heal with no
   * migration. Absent on records saved before this field existed.
   */
  detectedAllergens?: DetectedAllergenMatch[];
  /**
   * The seed list's `list_version` this product's {@link detectedAllergens}
   * was computed against — read from `assets/eu_allergens_seed.json`, never
   * hand-typed. `null`/absent means "never scanned" and is treated the same
   * as a version mismatch: live recompute, not trusted as zero matches.
   */
  allergenListVersion?: string | null;
}

/**
 * One matched EU-regulated fragrance allergen for a product (tech-design
 * vials-eu-allergen-detection.md FE-2). `canonical` is the seed entry's
 * display name; `restricted` mirrors that seed entry's own `restricted`
 * flag (true only for the two banned-but-retained entries — Lilial and
 * Lyral/HICC in the original 26-substance seed) and drives the Amber-vs-
 * Cobalt badge precedence. Deliberately has no per-user dimension (no
 * `isPersonal` flag) — personal-allergen flagging is a separate, descoped
 * follow-up (see spec Non-Goals).
 */
export interface DetectedAllergenMatch {
  canonical: string;
  restricted: boolean;
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
  /**
   * True when every merged procedure is in the aggressive set (deep peel,
   * energy-based lifting, injectable micro-wounding — see
   * AGGRESSIVE_PROCEDURES in src/utils/skinConditionModifiers.ts). Drives the
   * eczema/rosacea recovery caution line (US-25), which never appears for
   * Botox- or filler-only rehab. Derived per render, never persisted.
   */
  aggressive: boolean;
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
  /**
   * Routines screen Morning/Evening accordion snapshot, so a manual collapse
   * survives an app restart for the rest of the skincare day. Re-decided from
   * the 15:00 AM/PM rule once a new skincare day starts (see
   * getSkincareDateString). Null before the first decision is made.
   */
  routineAccordion: RoutineAccordionSettings | null;
  /**
   * ISO 8601 timestamp of when the user accepted the onboarding medical
   * disclaimer (MarketingSlidesScreen slide 3 consent checkbox). Null until
   * accepted.
   */
  medicalDisclaimerAcceptedAt: string | null;
  /**
   * Copy version of the medical disclaimer the user last accepted. Defaults
   * to 0 pre-acceptance — a value that can never collide with a real version
   * (versions start at 1) so "never accepted" is unambiguous from this field
   * alone.
   */
  medicalDisclaimerVersion: number;
  /**
   * Global state for the product-contribution consent flow
   * (docs/specs/contribution-consent-flow/) — distinct from
   * `ContributionConsent` (the photo-sharing consent on `UserProfile`).
   * Governs whether `ContributionConsentModal` / `ContributionToggle` appear
   * when a manually-added product is saved.
   */
  contributionConsentStatus: ContributionConsentStatus;
  /**
   * Manual saves declined (toggle off) since the last reminder modal was
   * shown. Only meaningful while `contributionConsentStatus === 'declined'`.
   */
  declinedSaveCountSinceLastReminder: number;
  /**
   * Reminder modals shown so far: 0 = none yet, 1 = 1st shown, 2 = 2nd,
   * 3+ = 3rd/every-30 tier. Drives the next reminder threshold (5/15/30/30…).
   */
  reminderCountShown: number;
  /**
   * Per-procedure RehabNoticeCard collapse state on the Routines screen,
   * keyed by RehabNotice.key, so a manual collapse survives a re-visit for
   * the rest of the skincare day — mirrors `routineAccordion`'s day-scoping.
   * Re-decided (defaults to expanded) once a new skincare day starts.
   */
  rehabNoticeCollapsed: Record<string, NoticeCollapseEntry>;
  /**
   * Per-row collapse state for ConflictWarningInline's conflict /
   * condition-advisory / density rows on the Routines screen, keyed by each
   * row's own stable id (rule id, advisory id, or finding id, prefixed by
   * row kind). Same day-scoped shape and semantics as `rehabNoticeCollapsed`:
   * a manual collapse/expand survives a re-visit for the rest of the
   * skincare day, and re-decides (defaults to expanded) once a new one
   * starts. Kept as a separate map from `rehabNoticeCollapsed` since row ids
   * are not guaranteed unique across the two features.
   */
  routineNoticeCollapsed: Record<string, NoticeCollapseEntry>;
}

/**
 * Product-contribution consent state machine (docs/specs/contribution-consent-flow/01-copy-and-consent-states.md).
 * - unset: never seen the modal — shown on next manual save.
 * - declined: seen at least once, not opted in — reminder cadence applies.
 * - accepted: opted in at least once — no modal, ever again.
 * - disabled: explicit opt-out in Profile — no modal, no toggle, ever.
 */
export type ContributionConsentStatus = 'unset' | 'declined' | 'accepted' | 'disabled';

export interface RoutineAccordionSettings {
  /** Skincare-day date string (see getSkincareDateString) this snapshot applies to. */
  date: string;
  morningExpanded: boolean;
  eveningExpanded: boolean;
}

/**
 * Shared day-scoped collapse decision shape for Routines-screen advisory
 * rows — used by `rehabNoticeCollapsed` and `routineNoticeCollapsed`.
 */
export interface NoticeCollapseEntry {
  /** Skincare-day date string (see getSkincareDateString) this decision applies to. */
  date: string;
  collapsed: boolean;
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
  /**
   * Local URI of the captured front-label photo. The same shot becomes the
   * product cover on save AND is what the optional "Read label" OCR helper
   * reads — so it lives on the draft. null until a photo is taken/chosen.
   */
  localImageUri: string | null;

  /**
   * Labelled SPF, captured only when productType is 'spf' (US-29). Null =
   * unknown; the adequacy check skips the product rather than assuming a
   * worst case. Cleared when the category moves away from SPF.
   */
  spfValue: number | null;

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
  /** sourceUri: the captured/picked photo's local file uri, when known — lets
   *  a caller reuse the identification shot as the product's cover photo
   *  even when OCR/corpus matching doesn't pan out. Null for a re-OCR of an
   *  already-stored image (CameraCaptureModal's `sourceImageUri` prop) or a
   *  gallery pick that didn't report one. */
  | { mode: 'label'; rawText: string; sourceUri: string | null }
  | { mode: 'barcode'; code: string }
  /** hadNonLatin: ocrTextCleaner stripped a significant non-Latin share. */
  | { mode: 'inci'; rawText: string; hadNonLatin: boolean; sourceUri: string | null };

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

// ─── Product Profile (docs/tasks/product_profile/01-product-profile.md §5) ────
// Milestone 1 (docs/specs/2026-08-05-product-profile-m1.md): a single composed
// object describing "what this product is," built by src/utils/productProfile/
// from resolvedActiveKeys × actives.json. Descriptive only — never a
// recommendation/eligibility verdict (that stays Conflict Engine / Routine
// Engine territory). Types transcribed verbatim from the locked source design.

/** Three-tier confidence model applied per-field, not just per-profile. */
export type ProfileConfidence = 'deterministic' | 'heuristic' | 'insufficient_data';

/**
 * Attached to any field whose value depends on more than a direct
 * pass-through lookup. Required so a consumer can decide whether to
 * display, hide, or caveat a value without re-deriving its provenance.
 */
export interface ConfidenceNote {
  confidence: ProfileConfidence;
  /** Populated whenever confidence !== 'deterministic'. Human-readable. */
  caveat?: string;
  /** Which source(s) this value was derived from, for auditability.
   *  e.g. ['actives.json:goals.hydration', 'labels.ts:FUNCTIONAL_BENEFIT_INGREDIENTS'] */
  sourceRefs: string[];
}

/**
 * All 10 capability keys are declared now; only `barrierRepair`/`exfoliation`
 * are scored in Milestone 1 (docs/tasks/product_profile/03-capabilities.md).
 * The remaining 8 ship with `score: null`/`confidence: 'insufficient_data'`.
 */
export type CapabilityKey =
  | 'hydration'
  | 'barrierRepair'
  | 'brightening'
  | 'pigmentation'
  | 'acneControl'
  | 'sebumRegulation'
  | 'antioxidantProtection'
  | 'soothing'
  | 'exfoliation'
  | 'antiAging';

export interface CapabilityScore extends ConfidenceNote {
  /** Normalized 0–1 presence-weighted score. Null iff confidence === 'insufficient_data'. */
  score: number | null;
  /** Active classes that contributed positively to this score. */
  contributingClasses: ActiveIngredientKey[];
}

export interface IrritationProfile extends ConfidenceNote {
  /** Aggregate 0–5 scale, same units as actives.json's per-class irritancy. Null iff insufficient_data. */
  score: number | null;
  photosensitizing: boolean;
  lowPh: boolean;
  /** Which aggregation method produced `score` — see 02-profile-builder.md §5. */
  aggregationMethod: 'max_of_present' | 'potency_weighted_average';
}

export interface SensitivityCompatibility extends ConfidenceNote {
  /** Null iff irritation.score is null. */
  compatible: boolean | null;
  /** The irritation-scale cutoff applied to produce `compatible`. */
  thresholdUsed: number | null;
}

export interface RoutinePosition extends ConfidenceNote {
  /** Merged from allowedPeriods across all present classes. */
  eligiblePeriods: ('AM' | 'PM')[];
  preferredPeriod: 'AM' | 'PM' | null;
  /** Position in the (relocated) layering-order table. Null if the product's
   *  type/classes aren't represented in that table. */
  layeringOrder: number | null;
  rinseOff: boolean;
}

export interface ProfileStrengthsWeaknesses {
  /** Template-generated, references capability scores above the strength threshold. */
  strengths: string[];
  /** Template-generated. MUST include structural caveats (e.g. "no concentration
   *  data available") when relevant — never presented as a simple negative-findings list. */
  weaknesses: string[];
}

export interface ProductProfile {
  // ── Identity — required, deterministic pass-through, no aggregation ──
  productId: string;
  productType: ProductType;
  brand: string | null;
  name: string;

  // ── Ingredient basis — required ──
  sourceInciText: string | null;
  resolvedActiveKeys: ActiveIngredientKey[];
  /** Text tokens present in the INCI list that matched no known class.
   *  Non-empty values are a live signal of matcher-table gaps. */
  unresolvedIngredientTokens: string[];

  // ── Primary functions — required, heuristic pending taxonomy consolidation ──
  primaryFunctions: {
    key: CapabilityKey;
    rank: number;
  }[];

  // ── Capability scores — required object; individual entries may be null-scored ──
  capabilities: Record<CapabilityKey, CapabilityScore>;

  // ── Irritation & sensitivity — required ──
  irritation: IrritationProfile;
  sensitivityCompatibility: SensitivityCompatibility;

  // ── Routine placement — required ──
  routinePosition: RoutinePosition;

  // ── Synthesis — optional; null until capabilities/irritation are populated ──
  strengthsWeaknesses: ProfileStrengthsWeaknesses | null;

  // ── Build metadata ──
  builtAt: string; // ISO 8601
  /** Schema/algorithm version. A mismatch against the current builder version
   *  means "treat as stale," per the lifecycle rules in
   *  docs/tasks/product_profile/01-product-profile.md §3. */
  builderVersion: string;
  /** Worst-case confidence across all required fields — a fast filter for
   *  "is this profile trustworthy enough to use," without inspecting every field. */
  overallConfidence: ProfileConfidence;
}
