# Product Intelligence — Open Questions

Status: DESIGN — architecture confirmed, ready for implementation. Decisions below are final unless explicitly marked still open.

This document collects every question surfaced while writing `00-overview.md` through `05-roadmap.md`. Most are now resolved; a small remainder stays open without blocking the start of Milestone 1.

---

## Decision Log (locked — do not revisit without a new RFC)

| # | Question | Final decision |
|---|---|---|
| 1 | Irritation aggregation method | `max_of_present` |
| 4 | Routine position merge rule | Most restrictive wins |
| 6 | Confidence field granularity | Three-tier enum only — no numeric confidence score |
| 7 | Scope of `insufficient_data` in Decision Engine outcomes | Never blocks a verdict — only omits the affected field or lowers confidence |
| 9 | Capability taxonomy consolidation | Required part of Milestone 2 — not optional technical debt, not indefinitely deferrable |
| 10 | Similarity weighting formula | Left as a tunable implementation detail, to be set post-launch against real usage data |
| 12 | Decision Engine bypassing Product Profile | Never, under any circumstance — including real-time/scan-triggered flows |
| — | Status of Product Profile itself | Confirmed as the first-class domain object and single source of truth for all product-level reasoning; every Decision Engine feature consumes Product Profiles, never raw ingredient classes or corpus records directly |

## Still open (do not block starting implementation)

- **Q2** — capability score saturation constant. Needed by Milestone 2.
- **Q3** — sensitivity compatibility threshold value. See caution below.
- **Q5** — Product Profile persistence/caching approach. Needed by Milestone 1; low-risk to revise later.
- **Q8** — relocation ownership for `LAYERING_ORDER`/`RINSE_OFF_TYPES`. An implementation task, not an open design question — see §8.
- **Q11** — Primary Functions ranking constants (N, floor threshold). Needed by Milestone 2; safe to ship with placeholders.

**One caution before Milestone 1 starts:** Q3's actual numeric threshold has not been set — this is a clinical/product call, not an engineering default, and nothing in this design set invents one. Per `01-product-profile.md`, `sensitivityCompatibility.compatible` may legitimately ship as `null` until that number is decided, so this does not block Milestone 1 technically — but it should be scheduled explicitly, or the field stays permanently uninformative to users rather than temporarily so.

---

## 1. Irritation aggregation method

**Question:** how should per-class `irritancy` values combine into one product-level score?

- **Decision (final):** `max_of_present` — the highest irritancy value among present classes, adjusted by potency where `irritancyByPotency` exists.
- **Alternative considered, not selected:** `potency_weighted_average` — a weighted mean across all present classes. Better represents cumulative real-world irritation but requires a weighting formula with no existing precedent, and was judged not worth the added design risk for a first version.
- **Rationale:** `max_of_present` is simple, conservative (never underestimates risk from a single strong irritant), and shippable without inventing a new formula. Revisit only if real-world profiles show it materially underestimates cumulative irritation.
- **Status:** Resolved. `aggregationMethod` remains a labeled field on `IrritationProfile` rather than a silent constant, so this stays visible and auditable even though it's no longer a live decision point.

---

## 2. Capability score saturation constant

**Question:** what value of `expected_saturation_count` (the number of contributing classes that constitutes a "fully saturated," score-1.0 capability) should the builder use?

- **Current recommendation:** 3, as a starting placeholder, per `02-profile-builder.md` §6.
- **Alternatives:** a per-capability constant (e.g. Sebum Regulation, with only 3 possible contributing classes total per `03-capabilities.md`, saturates faster than Anti-aging with 6 possible classes); or a formal `capabilityWeight` numeric field on `actives.json` classes (not yet added to the ruleset schema), replacing presence-counting with weighted contribution entirely.
- **Trade-offs:** a single flat constant is simple to ship but produces uneven scores across capabilities with different possible-class counts. Per-capability constants fix that but need a value chosen per capability — more product judgment required up front. The `capabilityWeight` field is the most correct long-term answer but requires a ruleset schema change and is explicitly deferred (`05-roadmap.md`, Deferred section).
- **Decision needed before:** Milestone 2 (full capability set) — Milestone 1 only needs this for two capabilities and the flat placeholder is acceptable there.

---

## 3. Sensitivity compatibility threshold

**Question:** at what aggregate irritation score does a product stop being "sensitive-skin compatible"?

- **Current recommendation:** none proposed in this design — this is a clinical judgment, not an engineering default, and should not be invented silently by whoever implements Milestone 1.
- **Alternatives:** a fixed cutoff (e.g. irritation score `> 3` on the existing 0–5 scale); a phototype-adjusted cutoff (lower tolerance for higher-phototype-risk users, echoing `phototypeModifiers`' existing pattern elsewhere in the ruleset).
- **Trade-offs:** a fixed cutoff is simple and consistent but ignores that "sensitive-skin compatible" already varies by user context elsewhere in the app (`phototypeModifiers`). A phototype-adjusted cutoff is more consistent with existing patterns but couples Product Profile (which is explicitly single-product, stateless per `02-profile-builder.md` §1) to user-profile data — a boundary this design deliberately avoids elsewhere (see Question 9 below).
- **Decision needed before:** Milestone 1 (this field is required, per `01-product-profile.md` §6, though it may legitimately return `null` until a threshold is set).

---

## 4. Routine position merge rule on period disagreement

**Question:** when a product contains classes that disagree on `preferredPeriod` (one prefers AM, another PM), what rule resolves it?

- **Decision (final):** "most restrictive wins" — if any present class has a hard single-period *requirement* (not merely a soft preference), that requirement wins.
- **Alternatives considered, not selected:** majority vote among present classes; an explicit priority ordering of classes (e.g. safety-driven restrictions always outrank efficacy-driven preferences).
- **Rationale:** safety-conservative and consistent with how the rest of the ruleset already treats hard vs. soft constraints.
- **Implementation note carried forward (not a re-opened question):** confirm during Milestone 1 build that "requirement" vs. "preference" is already a real, queryable distinction in `actives.json` rather than something the builder has to infer — a verification task, not a design decision.
- **Status:** Resolved.

---

## 5. Product Profile persistence and cache invalidation

**Question:** where does a built `ProductProfile` live, and what triggers a rebuild beyond the `builderVersion` mismatch already specified in `01-product-profile.md` §3?

- **Current recommendation:** cache alongside the corpus product record (same store, keyed by `productId`), rebuilt lazily on read when `builderVersion` is stale — no separate persistence layer.
- **Alternatives:** compute on every read with no caching (simplest, but repeats the full aggregation pipeline on every Product Detail view); a dedicated profile cache/table independent of the corpus.
- **Trade-offs:** lazy rebuild-on-stale-read is cheap to implement and keeps profile freshness tied directly to the one versioning mechanism already designed (`builderVersion`), but means the *first* read after any ruleset change pays the full build cost synchronously — acceptable for a single Product Detail view, worth revisiting if a future feature needs to batch-read many profiles at once (e.g. Similarity across a large shelf, Milestone 5).
- **Decision needed before:** Milestone 1, but low-risk to change later since no consumer in this design reaches into cache internals directly — everything goes through the Builder's public output shape.

---

## 6. Confidence field granularity

**Question:** is the three-tier `ProfileConfidence` enum (`deterministic`/`heuristic`/`insufficient_data`) sufficient, or does the Decision Engine eventually need a finer-grained numeric confidence score?

- **Decision (final):** the three-tier enum, as specified in `01-product-profile.md` §7, is confirmed as the permanent model — no numeric confidence score is planned.
- **Alternative considered, not selected:** a numeric 0–1 confidence score per field, allowing finer comparison (e.g. ranking two `heuristic` capabilities against each other).
- **Rationale:** the enum is sufficient for every rule specified in `04-decision-engine.md`, which only ever needs "worst tier" comparisons, never fine-grained ranking. A numeric score would only pay for itself once a consumer needs to rank multiple heuristic values against each other — no such consumer exists in this design.
- **Status:** Resolved. If a future feature genuinely needs heuristic-vs-heuristic ranking, that requires a new RFC, not a quiet extension of this enum.

---

## 7. Scope of `insufficient_data` in Decision Engine outcomes

**Question:** should `insufficient_data` ever hard-block a Decision Engine outcome (e.g. refuse to return any verdict at all), or only ever lower confidence/exclude that one field, as specified in `04-decision-engine.md`'s cross-cutting rule?

- **Decision (final):** never hard-block. `insufficient_data` only ever omits the affected capability from the calculation or lowers the resulting verdict's `confidence` field — a verdict is always returned. A product missing Antioxidant Protection data can still receive a Buy verdict based on other, measured capabilities.
- **Alternative considered, not selected:** a stricter mode withholding the verdict entirely if too high a proportion of relevant capabilities are `insufficient_data`.
- **Rationale:** withholding a verdict is a form of blocking regardless of how the threshold is framed, and introduces a new tunable constant with no existing precedent. Confidence propagation (already part of the design, `04-decision-engine.md` Stage 4) communicates the same "go easy on this one" signal without ever refusing to answer.
- **Status:** Resolved. `04-decision-engine.md`'s Buy-path fallthrough behavior (falling through to a different verdict tier when the only apparent new capability is unmeasured) is *not* a block — it's the verdict correctly reflecting the evidence that does exist. A verdict is always produced.

---

## 8. Relocation timing for `LAYERING_ORDER` and `RINSE_OFF_TYPES`

**Question:** these are currently routine-engine-private code constants (`slotting.ts`, `productFacts.ts`) that Milestone 1 requires as data in `constants/rulesets/`. Who owns this move, and does it need routine-engine-team review given they're consumed by both systems afterward?

- **Current recommendation:** treat as a Milestone 1 prerequisite task, mechanical relocation (data move, not logic change), reviewed by whoever owns `routineEngine/` given they remain a consumer.
- **Alternatives:** duplicate the tables temporarily (one copy in Product Intelligence, one left in place) to decouple the two milestones' timelines.
- **Trade-offs:** relocation is the architecturally correct move and was already identified as low-risk in the original audit (mechanical, no behavior change if done correctly) — duplication reintroduces exactly the drift risk this whole design exists to prevent (echoing `isStrongActive()`'s five-way duplication), so is explicitly **not recommended** despite being faster short-term.
- **Decision needed before:** Milestone 1 start.

---

## 9. Ownership and timeline of capability taxonomy sign-off

**Question:** Milestone 2 requires a product owner to choose one reconciled membership list per capability (e.g. does panthenol count as Hydration). Who makes this call, and what happens if it's not ready when Milestone 1 completes?

- **Decision (final):** capability taxonomy consolidation is a **required** part of Milestone 2 — not optional technical debt, and not something Milestone 2 can be considered complete without. It does not run as an indefinite parallel track alongside later milestones.
- **Sequencing (unchanged):** sign-off work starts alongside Milestone 1, since Milestone 1 only needs the two `deterministic` capabilities and requires no reconciliation — but it must land *before* Milestone 2 is marked done, not merely "in progress alongside" it.
- **Alternative considered, not selected:** treating the interim canonical source (`actives.json` only, per `03-capabilities.md` §0) as an acceptable indefinite state and letting "reconciled" stay aspirational. Explicitly rejected — this is exactly the drift pattern (a "temporary" workaround quietly becoming permanent) this whole design exists to close, and the interim source's `heuristic` tag is only an honest answer if consolidation is actually still scheduled, not abandoned.
- **Status:** Resolved on requirement; **still open on owner.** An explicit product-owner name still needs to be assigned before Milestone 2 can start — this is a process gap, not a design gap, and should be closed before Milestone 1 finishes.

---

## 10. Similarity weighting formula

**Question:** what is the precise formula combining the primary `resolvedActiveKeys` Jaccard score with the secondary capability-overlap weighting described in `04-decision-engine.md` Stage 1?

- **Decision (final):** deliberately left unset. This is a tunable implementation detail, not a pre-launch architectural decision — the exact formula (linear blend vs. two-stage filter, and any weight constants) is to be chosen when Milestone 5 starts, informed by real shelf/usage data rather than decided speculatively now.
- **Options still on the table at implementation time:** a linear blend (e.g. `0.7 * jaccard + 0.3 * capability_overlap`); a two-stage filter (Jaccard produces a candidate shortlist, capability overlap only re-ranks within it).
- **Status:** Resolved as "intentionally deferred." Does not block Milestones 1–4. Whoever implements Milestone 5 should treat the constant/formula as config, not a hardcoded literal, so it can be retuned without a schema change once real data exists.

---

## 11. Primary Functions ranking constants (N and floor threshold)

**Question:** `02-profile-builder.md` §7 proposes top-N=3 and a minimum floor score of 0.3 as placeholders for which capabilities count as a product's "primary functions." Are these the right values?

- **Current recommendation:** ship the placeholders in Milestone 2, treat as tunable without a schema change (both are simple constants, not structural).
- **Alternatives:** make N and the floor configurable per product type (a cleanser's "primary functions" may reasonably need a different floor than a serum's, given typical ingredient density differences between types).
- **Trade-offs:** global constants are simpler and sufficient until real usage data suggests otherwise. Per-type tuning is more correct but is speculative without data to justify the added complexity now.
- **Decision needed before:** not blocking — safe to ship with placeholders and revisit post-launch with real product data.

---

## 12. Whether the Decision Engine should ever bypass Product Profile

**Question:** `00-overview.md` §3 states the Decision Engine never reads `actives.json` or the corpus directly. Are there legitimate edge cases where this should be relaxed (e.g. a real-time OCR-scanned product with no profile built yet)?

- **Decision (final):** no bypass, no exceptions — including real-time/scan-triggered flows. An unscanned/unprofiled product must trigger an on-demand profile build (even a minimal, Milestone-1-shaped one) rather than the Decision Engine special-casing raw ingredient data anywhere, for any reason.
- **Alternative considered, explicitly rejected:** a lightweight, ungenerated "quick profile" for real-time scan flows, distinct from the full cached `ProductProfile`. Rejected because it reintroduces a second parallel aggregation path — precisely the drift risk (two independently-computed versions of the same fact) this entire design exists to prevent, and Product Profile is now confirmed as *the* single source of truth for product-level reasoning, with no sanctioned exception.
- **Status:** Resolved, and elevated from a per-integration question to a standing architectural rule (see `00-overview.md`'s updated §3.1). Any future integration between Product Intelligence and the Universal Scanner overlay (`IMPLEMENTATION_PLAN.md` Phase 4) must go through a profile build, full stop.
