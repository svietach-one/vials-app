# Decision Engine — Design

Status: LOCKED — architecture confirmed, ready for implementation.
Depends on: `01-product-profile.md`, `02-profile-builder.md`. Every stage below consumes `ProductProfile` objects as its primary input — never raw `activeKeys` or `actives.json` directly, and never a corpus record directly. This is a binding architectural rule with no exceptions, confirmed final (see `00-overview.md` §3.1, `06-open-questions.md` Q12).

---

## Stage 1 — Similarity

**Question answered:** how similar is this product to products already on the user's shelf?

- **Input:** one candidate `ProductProfile` + a collection of shelf `ProductProfile[]` (the shelf collection comes from the corpus, resolved to profiles via the builder — not raw corpus records).
- **Output:** a ranked list of `{ productId, score: number (0–1), sharedCapabilities: CapabilityKey[], sharedActiveKeys: string[] }`.
- **Dependencies:** Product Profile Builder (must already exist for every shelf product being compared against — no on-the-fly building inside this stage).
- **Algorithm:** weighted Jaccard similarity over `resolvedActiveKeys`, with a secondary weighting pass by `capabilities` score overlap (two products sharing an active class that's a *primary* function for both should score higher than sharing one that's incidental for both). Exact weighting formula is a design decision deferred to `06-open-questions.md` — this stage is new algorithm work, not a data question; the underlying data (`resolvedActiveKeys`, `capabilities`) is fully available once profiles exist.
- **Explanation strategy:** surface `sharedActiveKeys` and `sharedCapabilities` directly — "similar because both contain niacinamide and both score high on Soothing" is reconstructable straight from the two profiles' fields, no separate explanation logic needed beyond formatting.

---

## Stage 2 — Gap Coverage

**Question answered:** what new capability would this product add to the user's shelf/routine that isn't already covered?

- **Input:** candidate `ProductProfile` + shelf `ProductProfile[]` + user profile's goal set (`UserProfile` — existing type, read-only here).
- **Output:** `{ newCapabilities: CapabilityKey[], alreadyCovered: CapabilityKey[], coverageDelta: number }`.
- **Dependencies:** `goalCoverage.ts` — **reused directly**, not reimplemented. Its existing primitive (checks a routine's covered goals against profile goals) answers this question unmodified once given profile-shaped capability data instead of routine-step data; per the earlier audit, this was already identified as "the best-covered of the Decision Engine questions."
- **Algorithm:** set-difference between the candidate's `primaryFunctions`/`capabilities` (score above the strength threshold from `02-profile-builder.md` §11) and the union of the same across all shelf profiles, intersected with the user's stated goals for relevance ranking.
- **Explanation strategy:** name the specific new capability and cite the contributing active classes from the candidate profile's `CapabilityScore.contributingClasses` — e.g. "adds Barrier Repair (ceramides, niacinamide), which nothing on your shelf currently covers."

**Note:** this stage's correctness is bounded by `03-capabilities.md`'s interim-canonical-source caveat — a "new capability" claim is only as reliable as the `heuristic` tag already attached to that capability on the underlying profiles. This stage does not need to re-litigate that; it inherits the confidence tags as-is and should surface them (see Recommendation, Stage 4, for how confidence propagates into the final verdict).

---

## Stage 3 — Routine Impact

**Question answered:** if the user added this product, what would change in their actual routine?

- **Input:** candidate `ProductProfile` + current routine state (existing `routinesStore` shape).
- **Output:** a diff/preview object: steps added, any conflicts introduced (via Conflict Engine), slotting/order changes — same shape the routine engine already produces for other planning operations, not a new output format.
- **Dependencies:** the routine engine's existing pipeline (`generate.ts`/`resolve.ts`), Conflict Engine, and the candidate profile's `routinePosition` field (period, layering order) as the seed input to slotting.
- **Algorithm:** `substitute.ts` already answers a scoped version of this question (same-slot replacement) — this stage requires only a new **insert-mode** entry point into `generate.ts`/`resolve.ts` that runs the existing admission/sequencing logic for an addition rather than a substitution. No new sequencing algorithm; a new call shape into an existing one.
- **Explanation strategy:** reuse `decisionReasons.ts`'s existing reason-code vocabulary, since the routine engine already emits these during normal plan generation — this stage doesn't need its own explanation layer, only needs to run the existing pipeline in preview (non-committing) mode.

**Scope boundary:** this stage reads `routinePosition` from the Product Profile but does not duplicate routine-engine sequencing logic itself — layering order, period eligibility, and conflict checks all still live in their existing homes (`slotting.ts`, `conflictEngine.ts`). Product Profile only supplies the facts; Routine Impact only orchestrates an existing pipeline against them.

---

## Stage 4 — Recommendation

**Question answered:** should the user Buy / Replace / Skip / Avoid this product?

- **Input:** the outputs of Stages 1–3 for the candidate product, plus `eligibility.ts`'s hard-gate evaluation and Conflict Engine's pairwise-conflict evaluation against the current routine.
- **Output:** `{ verdict: 'buy' | 'replace' | 'skip' | 'avoid', confidence: ProfileConfidence, reasons: DecisionReasonCode[] }`.
- **Dependencies:** all of Stages 1–3, `eligibility.ts`, Conflict Engine, `decisionReasons.ts`.
- **Algorithm:** a priority-ordered composition, evaluated in this order (first match wins):
  1. **Avoid** — if `eligibility.ts`'s hard gates fail (e.g. a pregnancy-restricted ingredient class present, per `pregnancy.ts`).
  2. **Skip** — if Conflict Engine flags a same-day ingredient conflict against the current routine with no available resolution slot.
  3. **Replace** — if Similarity (Stage 1) finds a shelf product above a high-similarity threshold *and* Gap Coverage (Stage 2) finds no meaningful new capability — the candidate is redundant with something already owned.
  4. **Buy** — if Gap Coverage (Stage 2) finds a genuine new capability and Routine Impact (Stage 3) shows a clean insertion (no unresolved conflicts).
  
  This is pure composition over existing primitives — no new ingredient data is required, matching the prior architecture analysis's finding that Recommendation is the only stage needing new *logic* rather than new *data*.
- **`confidence` field:** the verdict's own confidence is the worst confidence tier among every profile field the composition actually touched (e.g. if the "Buy" verdict rests partly on a `heuristic` Gap Coverage capability, the verdict itself is `heuristic`, not `deterministic` — confidence propagates through the composition rather than resetting at each stage).
- **Explanation strategy:** concatenate the specific reason codes surfaced by whichever stage(s) triggered the verdict — e.g. an "Avoid" verdict cites the exact `eligibility.ts` gate that failed; a "Buy" verdict cites Gap Coverage's named new capability plus Routine Impact's clean-insertion confirmation. No verdict is returned without at least one attached reason code — an unexplained recommendation is treated as a bug, not a valid output shape.

---

## Cross-cutting rule: `insufficient_data` propagation (finalized, see `06-open-questions.md` Q7)

Per `01-product-profile.md` §8, no stage in this Decision Engine treats a Product Profile field's `null`/`insufficient_data` as `0`, and **`insufficient_data` never blocks a verdict from being returned** — it only removes that one field from consideration or lowers the verdict's `confidence`. A recommendation is always produced. Concretely:
- Gap Coverage excludes `insufficient_data` capabilities from both the "new" and "already covered" sets — it never claims a gap is filled or unfilled based on an unmeasured capability.
- Recommendation's Buy path cannot cite an `insufficient_data` capability as the reason for a Buy verdict. If the *only* apparent new capability is `insufficient_data`, the verdict falls through to a different tier (e.g. Skip, with a "not enough data to recommend on this basis" reason) — this is the verdict correctly reflecting the evidence that does exist, not a refusal to answer. The user still receives a verdict, just one with appropriately lowered confidence and an explicit reason naming what's unmeasured.
