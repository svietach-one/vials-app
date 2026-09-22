# Product Intelligence — Implementation Roadmap

Status: LOCKED — architecture confirmed, ready for implementation.
Depends on: `00-overview.md` through `04-decision-engine.md`.

Ordering principle: smallest milestone that produces a real, testable artifact — either user-visible or a direct unlock for the next milestone. No milestone requires speculative work beyond what the next milestone consumes. Per the design brief, Milestone 1 already delivers user-visible value; it is not scaffolding.

---

## Milestone 1 — Product Profile v1 (deterministic core) + first UI surface

**Goal:** Build the corpus×ruleset join helper and a minimal Product Profile Builder producing only the fields that can ship at `deterministic` or near-deterministic confidence today, surfaced on the Product Detail screen.

**Scope:**
- Corpus × ruleset join helper (`02-profile-builder.md` §5).
- Profile Builder stages 1, 2, 5 (irritation, using `max_of_present` as the initial aggregation choice — see `06-open-questions.md`), 6, 7 (routine position — `LAYERING_ORDER`/`RINSE_OFF_TYPES` relocation is a prerequisite, see below).
- Capabilities limited to Barrier Repair and Exfoliation only (the two `deterministic` capabilities per `03-capabilities.md`) — full capability set deferred to Milestone 2.
- No strengths/weaknesses synthesis yet (requires a broader capability set to be meaningful, per `02-profile-builder.md` §11).
- UI: a "Product Insights" panel on the existing Product Detail view, showing routine position, the two available capability badges, and an irritation indicator.

**Estimated complexity:** Medium. The join helper and builder skeleton are new but small; the UI surface is a straightforward addition to an existing screen.

**Dependencies:** Relocation of `LAYERING_ORDER` (`slotting.ts`) and `RINSE_OFF_TYPES`/`DEFAULT_PERIOD_BY_TYPE` (`productFacts.ts`) into `constants/rulesets/` as data — required because the builder must not import routine-engine-internal files (per `02-profile-builder.md` §10). This is a data move, not a logic change, and carries no behavior risk to the routine engine itself.

**Expected outcome:** the first real `ProductProfile` objects exist and are visible to users. This validates the interface from `01-product-profile.md` against an actual consumer immediately, rather than finalizing the schema on paper — consistent with the "ship with the first consumer" principle this design was built around.

---

## Milestone 2 — Capability taxonomy reconciliation (subset) + full capability set

**Goal:** Extend the interim canonical source (`03-capabilities.md` §0) with a reconciled definition for the four most-fragmented, highest-value capabilities — Hydration, Acne Control, Brightening, Soothing — and populate the remaining capability fields (all at `heuristic` confidence).

**This is a required task, not optional technical debt** (finalized per `06-open-questions.md` Q9) — Milestone 2 is not complete until reconciliation for these four capabilities has actually landed, not merely scheduled. An explicit product-owner assignment for the sign-off decision is still outstanding and should close before this milestone starts (see `06-open-questions.md` Q9).

**Scope:**
- Product-owner sign-off on a single membership list per capability, replacing the disagreements documented in `03-capabilities.md` (e.g. deciding whether panthenol counts as Hydration).
- Builder stage 3 (Capability Aggregation) extended to all 10 `CapabilityKey` values, with Antioxidant Protection explicitly returning `insufficient_data` (not attempted).
- Builder stage 4 (Primary Functions Ranking) activated now that a full capability set exists.

**Estimated complexity:** Medium-High. The reconciliation itself is a product decision requiring sign-off, not pure engineering — matches the prior architecture audit's finding that this specific item is the highest-leverage, highest-friction migration in the codebase.

**Dependencies:** Milestone 1 (builder skeleton, join helper).

**Expected outcome:** capability scores move from "two available, deterministic" to "ten available (nine scored, one explicitly unmeasured), heuristic but internally consistent" — no longer silently contradicting other files for the four reconciled capabilities.

---

## Milestone 3 — Strengths / Weaknesses synthesis

**Goal:** Activate builder stage 8, surfaced as plain-language "Key Strengths" / "Things to know" sections on the same Product Detail panel from Milestone 1.

**Scope:** Template synthesis over Milestones 1–2's outputs, per `02-profile-builder.md` §11 — including mandatory structural-caveat surfacing (e.g. explicitly stating "Antioxidant Protection not yet measured" rather than omitting it).

**Estimated complexity:** Low-Medium — composition over already-computed fields, no new data source.

**Dependencies:** Milestones 1 and 2 (needs a broad enough capability set for synthesis to be meaningful, per the `null`-until-populated rule in `01-product-profile.md` §6).

**Expected outcome:** the Product Profile becomes self-explanatory in the UI without a user needing to interpret raw capability scores.

---

## Milestone 4 — Gap Coverage (first Decision Engine primitive)

**Goal:** Adapt `goalCoverage.ts` to accept Product Profile-shaped input (candidate + shelf profiles) instead of routine-step input, per `04-decision-engine.md` Stage 2.

**Scope:** The adaptation itself, plus a UI surface — a "this adds [capability] to your shelf" badge shown on Catalog scan/search results before the user commits to adding a product.

**Estimated complexity:** Low — per both the original architecture audit and `04-decision-engine.md`, this is the best-supported of the four Decision Engine stages; `goalCoverage.ts`'s primitive is reused, not rebuilt.

**Dependencies:** Milestones 1–2 (needs a stable, multi-capability Product Profile for shelf-wide comparison to be meaningful — running Gap Coverage against only two deterministic capabilities from Milestone 1 alone would understate coverage).

**Expected outcome:** the first real Decision Engine output, visible to users, built entirely on Product Profile rather than raw ingredient data — proves the layering decision from the "Decision Engine on Product Profile vs. ingredient classes" discussion in practice.

---

## Milestone 5 — Similarity

**Goal:** Implement the weighted-Jaccard comparator from `04-decision-engine.md` Stage 1.

**Scope:** New comparison function over `resolvedActiveKeys` + `capabilities`; UI surface as a "Similar to products you own" section in Catalog/scan results.

**Estimated complexity:** Low-Medium — the underlying data is fully available from Milestone 1 onward; the weighting formula (`06-open-questions.md`) is the only open design piece.

**Dependencies:** Milestone 1 (minimum), benefits from Milestone 2's fuller capability set for the secondary weighting pass.

**Expected outcome:** second Decision Engine primitive live; can ship independently of Milestone 4 if sequencing needs to change, since neither depends on the other.

---

## Milestone 6 — Routine Impact

**Goal:** Add the insert-mode entry point into `generate.ts`/`resolve.ts` described in `04-decision-engine.md` Stage 3.

**Scope:** New call shape into existing routine-engine sequencing logic (no new sequencing algorithm); UI surface as a "See how this fits your routine" preview before adding a product.

**Estimated complexity:** Medium — touches the routine engine's existing pipeline, which carries more regression risk than the purely additive work in Milestones 4–5, even though the underlying logic is reused rather than rewritten.

**Dependencies:** Milestone 1 (`routinePosition` field must be populated and stable).

**Expected outcome:** third Decision Engine primitive live; the routine engine gains a non-committing preview mode that may have standalone UI value beyond the Decision Engine.

---

## Milestone 7 — Recommendation (full composition)

**Goal:** Implement the priority-ordered Buy/Replace/Skip/Avoid composition from `04-decision-engine.md` Stage 4.

**Scope:** The composition function itself (pure logic, no new ingredient data), plus a single verdict badge with attached explanation in the UI, replacing or supplementing the three separate signals from Milestones 4–6.

**Estimated complexity:** Medium — straightforward composition logic, but requires careful handling of the `insufficient_data` propagation rules (`04-decision-engine.md`, cross-cutting rule) to avoid a false-confidence verdict.

**Dependencies:** Milestones 4, 5, and 6 all complete — this stage composes their outputs and has no independent data needs beyond them.

**Expected outcome:** the first complete Decision Engine verdict, closing the loop described in `00-overview.md`.

---

## Deferred (explicitly out of scope for all milestones above)

Tracked here so they are not silently forgotten, not because they're unimportant:
- Antioxidant Protection ingredient modeling (new matcher classes + property).
- Ingredient concentration/dose weighting.
- Ingredient synergies (positive-combination modeling).
- Full five-way capability taxonomy consolidation (Milestone 2 only reconciles four capabilities; the remainder — and the four re-taxonomy files' other consumers outside Product Intelligence — stay as-is).
- Formal `confidence`/`evidenceLevel` fields on the underlying ruleset rule objects (distinct from the Product Profile's own per-field confidence, which this roadmap does deliver).

Each of these can be scheduled independently once Milestone 7 ships, without changing anything already built — they extend data and confidence, not architecture.
