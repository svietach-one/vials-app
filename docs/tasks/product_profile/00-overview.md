# Product Intelligence — Overview

Status: LOCKED — architecture confirmed, ready for implementation. See `06-open-questions.md` for the decision log.
Depends on: `docs/database/db-product-spec.md`, `docs/database/db-tech-design.md`, and the prior architecture audit of `src/constants/`, `src/utils/`, and `src/utils/routineEngine/`.

This document set is the implementation contract for **Product Intelligence** — the layer that turns raw ingredient data into product-level understanding and cross-product decisions. It assumes the architecture audit's core finding: the ingredient-level knowledge mostly already exists and is mostly correct; what's missing is composition, not data.

---

## 1. Why this exists

Today, ingredient knowledge lives at the *class* level (`actives.json`: 20 active-ingredient classes, their properties, conflicts, and goals) and the *corpus* level (live per-product active-key sets in `services/corpus/`). Nothing sits between them. Every feature that needs to reason about "this specific product" — the Catalog screen, a future recommendation feature, a similarity search — would otherwise have to re-derive product-level facts from ingredient-level data itself, inline, every time.

The codebase has already hit this failure mode multiple times before this design existed:
- `isStrongActive()`'s `irritancy >= 3` threshold, reimplemented inline in 5 files instead of called once
- `POTENCY_RANK`, independently duplicated in two files
- "What does this ingredient do," independently hand-authored in 5 disagreeing taxonomies

Product Intelligence exists to stop this from happening a sixth time, specifically for anything that needs to reason about a *product* rather than an *ingredient class*.

---

## 2. The four layers

### 2.1 Ingredient Knowledge Base (IKB)
**What it is today, not a new build.** The existing `src/constants/rulesets/` (`actives.json`, `procedures.json`, `seasons.json`, `pregnancy.ts`, `conflictRulesDb.ts`) plus `rulesetTypes.ts`'s typed loaders. Per-class facts: identity/matchers, safety properties (irritancy, photosensitizing, pairRules), routine facts (allowedPeriods, adaptation), and capability tags (concerns/goals — currently fragmented, see `03-capabilities.md`).

**Consumed directly by:** Routine Engine, Conflict Engine — these do not need Product Profile and are out of scope for this design. They reason per-ingredient-class during sequencing, which is correct and stays as-is.

### 2.2 Product Profile (new — this design)
A single composed, cached object representing *one specific product's* understanding: capability scores, irritation, routine placement, strengths/weaknesses. Built once per product (and rebuilt on ingredient-data or ruleset changes), not recomputed per feature. Full design in `01-product-profile.md`.

### 2.3 Decision Engine (new — this design, built on 2.2)
Cross-product reasoning: Similarity, Gap Coverage, Routine Impact, Recommendation. Every stage consumes Product Profiles as input — never raw ingredient classes directly. Full design in `04-decision-engine.md`.

### 2.4 Corpus
**What it is today, not a new build.** `services/corpus/` — the live, remote per-product data source (`IngredientRepository`, `ProductRepository`). Supplies the raw material (`activeKeys`, product metadata) that the Product Profile Builder consumes. Not modified by this design; only joined against.

---

## 3. How the layers interact

```
                    ┌─────────────────────────────────────┐
                    │      INGREDIENT KNOWLEDGE BASE         │
                    │   src/constants/rulesets/ (existing)     │
                    │   actives.json, procedures.json,           │
                    │   seasons.json, pregnancy.ts                │
                    └───────────────┬───────────────────────────┘
                                    │  read-only, per-class facts
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           ▼                           │
        │              ┌─────────────────────────┐               │
        │  CORPUS       │   PRODUCT PROFILE BUILDER │   ROUTINE     │
        │  (existing,   │       (new — 02)            │   ENGINE      │
        │   live,       ├──────────────────────────►  │  (existing,   │
        │   remote) ───►│  resolves activeKeys,       │   unchanged)  │
        │  per-product  │  joins IKB, aggregates       │               │
        │  activeKeys   │  capabilities/irritation,    │  CONFLICT     │
        │               │  computes routine position,  │  ENGINE       │
        │               │  synthesizes strengths/      │  (existing,   │
        │               │  weaknesses                  │   unchanged)  │
        │               └─────────────┬────────────────┘               │
        │                             │                                │
        │                             ▼                                │
        │               ┌─────────────────────────┐                    │
        │               │     PRODUCT PROFILE       │                   │
        │               │   (new — cached object,    │                   │
        │               │    one per product)          │                   │
        │               └─────────────┬───────────────┘                   │
        │                             │                                    │
        │                             ▼                                    │
        │               ┌─────────────────────────────┐                    │
        │               │       DECISION ENGINE          │                   │
        │               │         (new — 04)              │                   │
        │               │  Similarity | Gap Coverage |      │                  │
        │               │  Routine Impact | Recommendation   │                 │
        │               └─────────────────────────────────┘                   │
        └───────────────────────────────────────────────────────────────────┘
```

Key rule encoded in this diagram: **the Decision Engine never reads `actives.json` or the corpus directly.** It reads Product Profiles only. This is the single architectural decision this whole document set exists to enforce.

### 3.1 Design principle (locked): Product Profile is the single source of truth for product-level reasoning

This is now a confirmed, non-negotiable rule, not a default subject to case-by-case exceptions:

- **Product Profile is a first-class domain object.** It is not an internal cache or a convenience shape for one consumer — it is *the* representation of "what this product is" for every part of the system that reasons above the ingredient-class level.
- **Every Decision Engine feature (Similarity, Gap Coverage, Routine Impact, Recommendation) consumes Product Profiles exclusively.** None of the four stages in `04-decision-engine.md` may read `resolvedActiveKeys` from a corpus record directly, re-derive capability scores independently, or otherwise reconstruct product-level facts outside the Profile Builder.
- **No bypass exists, including for latency-sensitive flows.** A real-time consumer (e.g. the Universal Scanner overlay, `IMPLEMENTATION_PLAN.md` Phase 4) that doesn't yet have a cached profile for a scanned product must trigger a profile build — even a minimal one — rather than operating on raw ingredient data as a shortcut. See `06-open-questions.md` Q12 for the full rationale; this was evaluated and explicitly rejected as an exception.

The cost of this rule is that every new consumer of product-level facts has a hard dependency on the Profile Builder existing and being fast enough for its use case. The benefit — and the reason it's locked rather than left as a preference — is that it makes the failure mode already seen three times in this codebase (`isStrongActive()`, `POTENCY_RANK`, and the five-way capability taxonomy) structurally impossible to repeat for anything product-level: there is exactly one place capability scores, irritation aggregates, and routine placement are computed, and everything else reads that output.

---

## 4. What is explicitly out of scope for this design

- Changes to Routine Engine sequencing logic (`resolve.ts`, `skeleton.ts`, `slotting.ts`'s algorithms) — only `LAYERING_ORDER`'s *data* is relocated (see `02-profile-builder.md`), not its consumer logic.
- Changes to Conflict Engine's pairwise rules.
- Full consolidation of the 5 capability taxonomies — this design uses an *interim* canonical source and flags it as heuristic (see `03-capabilities.md`); full consolidation is a separate, already-identified migration item.
- Concentration/dose-weighted scoring, ingredient synergies, antioxidant ingredient modeling — explicitly deferred, tracked in `06-open-questions.md` and `05-roadmap.md`.

## 5. Assumptions carried into every downstream document

- The corpus's `activeKeys` per product are trustworthy inputs (no re-validation of corpus data quality in this design).
- `actives.json` remains the authoritative ingredient-class schema; this design extends it, never forks it.
- Product Profile is a read path only — it does not write back to the corpus or the ruleset.
- "Deterministic" in this document set means "same output for the same input, straight lookup or direct sum" — not "clinically validated." Several deterministic fields (e.g. potency ranks) are still clinically-unreviewed drafts per the underlying ruleset's own in-code comments.
