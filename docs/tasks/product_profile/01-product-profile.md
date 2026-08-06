# Product Profile — Design

Status: LOCKED — architecture confirmed, ready for implementation.
Depends on: `00-overview.md`.

---

## 1. Why Product Profile exists

Before this design, no object in the codebase represents "everything we understand about this one product." Ingredient-level facts are rich (`actives.json`) and product-level *raw* data exists (`services/corpus/`), but nothing composes the two. Every consumer that needs product-level understanding — Catalog display, a similarity search, a recommendation — would otherwise recompute the same aggregation independently, which is exactly the pattern that produced `isStrongActive()`'s five-way duplication elsewhere in the codebase.

Product Profile solves three problems:

1. **Single aggregation point.** Irritancy aggregation, capability scoring, and routine-position merging are computed once, in one module, instead of once per consumer.
2. **Explainability substrate.** Every field carries its own confidence and source references, so "why does this product show as high-irritation" is answerable by inspecting the object, not by re-deriving it.
3. **Reuse beyond the Decision Engine.** The same object can power a Product Detail screen, a Catalog capability badge, or a future recommendation feature without redefining "capability score" three different ways.

Product Profile is **descriptive, not prescriptive**. It does not decide whether a product should be blocked, recommended, or scheduled — that stays in Conflict Engine, Routine Engine, and (for cross-product decisions) the Decision Engine. Product Profile only answers "what is this product," never "what should the user do about it."

---

## 2. Responsibilities

**In scope:**
- Resolve a product's ingredient basis (from raw INCI text or pre-resolved corpus `activeKeys`) against the Ingredient Knowledge Base.
- Aggregate per-class facts into per-product capability scores, an irritation profile, and a routine-position summary.
- Track confidence and provenance per field.
- Synthesize a human-readable strengths/weaknesses summary.

**Explicitly not in scope:**
- Safety blocking or gating (that's `eligibility.ts` / Conflict Engine's job).
- Sequencing a product into an actual routine (that's Routine Engine's job — Product Profile only supplies facts Routine Engine can use).
- Any cross-product comparison (that's the Decision Engine — see `04-decision-engine.md`).
- Persistence/caching mechanics (see §3 — this design specifies *when* a profile should be rebuilt, not *where* it's stored; storage is a caller decision, tracked as an open question).

---

## 3. Lifecycle

A Product Profile is built, not stored as user input — it is always derived from other data and can always be regenerated.

**Build triggers:**
- On first read for a product that has no cached profile, or whose cached profile's `builderVersion` is older than the current builder version.
- On manual product save (new product added via `ProductForm` — see `SCREENS.md`), since a fresh INCI list is available immediately.
- On corpus sync updating a product's `activeKeys` (a remote match replaces a locally-guessed ingredient set).
- On Ingredient Knowledge Base version bump (an `actives.json` update changes the meaning of an existing `activeKey` — every cached profile referencing that class is now stale).

**Not a build trigger:**
- Reading a profile for display. Reads are idempotent against the cache.
- Routine changes, procedure logging, or any user action unrelated to the product's own ingredient data — Product Profile has no dependency on routine state or user profile state. (User-profile-relative reasoning, e.g. "does this match my goals," is Decision Engine territory, not Product Profile territory — see `06-open-questions.md` for why this boundary matters.)

**Staleness handling:** a profile is considered valid until its `builderVersion` no longer matches the current builder/schema version, at which point it is treated as absent (rebuilt on next read), not silently trusted.

---

## 4. Data flow

```
INPUT                          RESOLUTION                      COMPOSITION                    OUTPUT
─────                          ──────────                      ───────────                    ──────

Raw INCI text  ──┐
(from manual      │
 entry / OCR)      ├──► Ingredient       ──► Resolved       ──► Corpus×Ruleset  ──► Per-class
                   │    Parser              activeKeys[]        Join               facts bundle
Corpus              │    (existing,                             (new, small           │
activeKeys[]  ──────┘    reused)                                 helper)               │
(already resolved,                                                                     ▼
 preferred path)                                                              ┌──────────────────┐
                                                                                │  AGGREGATION        │
                                                                                │  STAGES (see 02)     │
                                                                                │  - capability scoring  │
                                                                                │  - irritation agg.      │
                                                                                │  - routine position       │
                                                                                │  - strengths/weaknesses     │
                                                                                └──────────┬──────────────────┘
                                                                                           ▼
                                                                                  ProductProfile
                                                                                  (cached, versioned)
```

Two entry points are supported because two real callers need them: `ProductForm`'s manual-save path only has raw INCI text at save time (no corpus match yet), while most reads go through the corpus, which already has resolved `activeKeys`. Both converge at the join stage.

---

## 5. TypeScript interface

This is the contract. No implementation logic — algorithms are described in `02-profile-builder.md`.

```typescript
/** Three-tier confidence model applied per-field, not just per-profile. */
type ProfileConfidence = 'deterministic' | 'heuristic' | 'insufficient_data';

/**
 * Attached to any field whose value depends on more than a direct
 * pass-through lookup. Required so a consumer can decide whether to
 * display, hide, or caveat a value without re-deriving its provenance.
 */
interface ConfidenceNote {
  confidence: ProfileConfidence;
  /** Populated whenever confidence !== 'deterministic'. Human-readable. */
  caveat?: string;
  /** Which source(s) this value was derived from, for auditability.
   *  e.g. ['actives.json:goals.hydration', 'labels.ts:FUNCTIONAL_BENEFIT_INGREDIENTS'] */
  sourceRefs: string[];
}

type CapabilityKey =
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

interface CapabilityScore extends ConfidenceNote {
  /** Normalized 0–1 presence-weighted score. Null iff confidence === 'insufficient_data'. */
  score: number | null;
  /** Active classes that contributed positively to this score. */
  contributingClasses: string[]; // ActiveIngredientKey[]
}

interface IrritationProfile extends ConfidenceNote {
  /** Aggregate 0–5 scale, same units as actives.json's per-class irritancy. Null iff insufficient_data. */
  score: number | null;
  photosensitizing: boolean;
  lowPh: boolean;
  /** Which aggregation method produced `score` — see 02-profile-builder.md §5. */
  aggregationMethod: 'max_of_present' | 'potency_weighted_average';
}

interface SensitivityCompatibility extends ConfidenceNote {
  /** Null iff irritation.score is null. */
  compatible: boolean | null;
  /** The irritation-scale cutoff applied to produce `compatible`. */
  thresholdUsed: number | null;
}

interface RoutinePosition extends ConfidenceNote {
  /** Merged from allowedPeriods across all present classes. */
  eligiblePeriods: ('AM' | 'PM')[];
  preferredPeriod: 'AM' | 'PM' | null;
  /** Position in the (relocated) layering-order table. Null if the product's
   *  type/classes aren't represented in that table. */
  layeringOrder: number | null;
  rinseOff: boolean;
}

interface ProfileStrengthsWeaknesses {
  /** Template-generated, references capability scores above the strength threshold. */
  strengths: string[];
  /** Template-generated. MUST include structural caveats (e.g. "no concentration
   *  data available") when relevant — never presented as a simple negative-findings list. */
  weaknesses: string[];
}

interface ProductProfile {
  // ── Identity — required, deterministic pass-through, no aggregation ──
  productId: string;
  productType: string; // ProductType, existing enum
  brand: string | null;
  name: string;

  // ── Ingredient basis — required ──
  sourceInciText: string | null;
  resolvedActiveKeys: string[]; // ActiveIngredientKey[], from corpus×ruleset join
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
   *  means "treat as stale," per the lifecycle rules in §3. */
  builderVersion: string;
  /** Worst-case confidence across all required fields — a fast filter for
   *  "is this profile trustworthy enough to use," without inspecting every field. */
  overallConfidence: ProfileConfidence;
}
```

---

## 6. Required vs. optional fields

**Required (always populated, never `undefined`):**
`productId`, `productType`, `brand`, `name`, `sourceInciText`, `resolvedActiveKeys`, `unresolvedIngredientTokens`, `primaryFunctions`, `capabilities` (the object itself — individual `CapabilityScore.score` values inside it may be `null`), `irritation`, `sensitivityCompatibility`, `routinePosition`, `builtAt`, `builderVersion`, `overallConfidence`.

**Optional (`null` is a valid, meaningful state, not an error):**
- `strengthsWeaknesses` — `null` until the builder has enough populated capability data to synthesize from. A profile with `overallConfidence: 'insufficient_data'` across most capabilities should not force a synthesized summary out of near-empty input.
- `routinePosition.layeringOrder` — `null` when the product type has no entry in the layering table.
- `routinePosition.preferredPeriod` — `null` when present classes have no period preference or disagree with no merge rule resolving them (see `06-open-questions.md`).

There is deliberately no `Partial<ProductProfile>` or "draft" variant. A caller either has a full profile or has none — this avoids a second confidence system layered on top of the per-field one already in the interface.

---

## 7. Confidence handling

Every non-trivial field carries its own `ConfidenceNote`. Three tiers, applied consistently:

- **`deterministic`** — direct lookup or straight sum from a single unambiguous source (e.g. `productType`, `barrierRepair` capability today, since it reads one explicit boolean property per class).
- **`heuristic`** — derived from a source known to disagree with at least one other source in the codebase, or from an aggregation formula that is a design choice rather than a fact (e.g. most capability scores today, irritation aggregation, primary function ranking).
- **`insufficient_data`** — no reliable source exists at all (e.g. Antioxidant Protection today — see `03-capabilities.md`).

`overallConfidence` on the profile itself is the **worst** tier present among required fields — not an average. A profile with nine `deterministic` capabilities and one `insufficient_data` capability is `insufficient_data` overall, so a consumer doing a fast trust check never has to enumerate every field to notice a real gap.

`sourceRefs` is populated on every non-deterministic field so a caveat is always traceable back to a specific file/table, not just a generic "estimated" label — this is what makes the profile audit-friendly rather than a black box.

---

## 8. Insufficient-data handling

Explicit rule, binding on the builder (detailed further in `02-profile-builder.md`):

**A capability with no reliable contributing data returns `score: null`, `confidence: 'insufficient_data'`, and a caveat explaining what's missing. It never returns `0`.**

A `0` score is a real, meaningful claim ("this product does not support this capability at all," derivable e.g. for a pure sunscreen's Barrier Repair score). Silently substituting `0` for "we don't know" would make an unmodeled capability (Antioxidant Protection today) indistinguishable from a product that genuinely has none — the single failure mode this rule exists to prevent.

Downstream consequence for the Decision Engine (detailed in `04-decision-engine.md`): any stage that would otherwise treat `null` as `0` in a sum or comparison must explicitly branch on `insufficient_data` and either exclude that capability from the calculation or surface it as an explicit caveat in its own explanation — never fold it in silently.
