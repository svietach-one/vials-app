# Product Intelligence — Future Expansion

Status: DRAFT — product/UX design, not yet built.
Depends on: all preceding UX documents. Cross-referenced against the locked architecture (`../00-overview.md` through `../06-open-questions.md`) to flag which ideas extend it cleanly versus which would require a new architectural RFC before design work could even start.

---

## MVP (covered by this document set + the engineering roadmap's Milestones 1–7)

- Single-product analysis: Product Intelligence + For You, per `02-analysis-screen.md`.
- Entry via My Shelf's **Add new** / **Explore new** buttons (`01-entry-points.md` §1), plus the required Product Detail integration (`03-product-page.md`, entry point #3).
- Buy / Replace / Skip / Avoid recommendation, with explanation.
- Wishlist: a considering state for products explored but not yet purchased, with a **Put on my shelf** conversion action (`01-entry-points.md` §6) — core to the My Shelf entry-point design, not a deferred add-on.

Nothing below is required for a coherent first release; everything below builds on top of the MVP without changing it.

---

## Near Future

These compose cleanly on the locked architecture — each is a new *consumer* of existing Product Profile / Decision Engine output, not a new primitive.

### Compare multiple products
Side-by-side view of 2–3 products, built directly on the Similarity stage (`../04-decision-engine.md` Stage 1) — the pairwise scoring this needs already exists as a concept; this is a UI extension (many-way comparison layout) rather than new reasoning.

### Share analysis
Export or share a single product's analysis card — reuses the existing `ExportBackupUtility` pattern (`SCREENS.md` §5) at a per-product scope instead of full-shelf scope. Notably, this is also a stated B2C Pro feature already in the business plan ("Export report for cosmetologist/doctor," `Vials_Business_Plan_v1_1.docx` §4) — sharing a single product's analysis is a natural smaller sibling of that larger export, and validating demand here could inform whether the full Pro export is worth prioritizing.

---

## Long-term Vision

These either depend on real usage data before they're worth designing in detail, or would require revisiting the locked architecture — each is flagged accordingly.

### Store mode
A faster, in-store-optimized variant of the scanner flow (`04-scanner-flow.md`) — larger CTAs, verdict-first layout by default rather than as Journey B's scoped exception, possibly an offline-first posture. Directly related to the Floating Scan button question deferred in `01-entry-points.md` — both should be evaluated together once there's evidence of how often Journey B actually happens versus Journey A/C. **No architecture change required** — this is a presentation-layer variant of an existing flow.

### Dermatologist / consultant mode
Multi-profile management, where one account reviews products or routines on behalf of several people — already named as a B2C Pro tier feature ("Multiprofile: family; consultants leading clients," `Vials_Business_Plan_v1_1.docx` §4). Product Intelligence would need to become profile-aware in a way it currently isn't (the locked architecture's `ProductProfile` is explicitly single-product and user-agnostic; only the Decision Engine's For You layer is user-relative, and only for one user at a time today). **Likely requires a scoped architecture extension**, not a rewrite — flagging here rather than in the engineering roadmap since it's speculative until the Pro tier itself is prioritized.

### AI explanations (open-ended natural-language Q&A)
Letting a user ask an open question about a product ("why is this bad for me specifically?") and getting a free-text answer, instead of the current closed-vocabulary reason-code explanations (`decisionReasons.ts` pattern, reused throughout `../04-decision-engine.md`). **This is the one item on this list that would genuinely require revisiting the locked architecture**, not just extending it — the current design's explainability guarantee (every claim traces to a specific field with a specific confidence tier) depends on explanations being generated from a closed, auditable vocabulary. Open-ended generation trades that guarantee for flexibility and would need its own RFC to define how (or whether) it preserves the same trust properties. Explicitly not assumed as a natural evolution of the current explanation system — a deliberate fork point, not a slider to turn up later.

### Ingredient learning
Using patterns in `unresolvedIngredientTokens` (already a field on `ProductProfile`, `../01-product-profile.md` §5) across many scans to surface candidate new matcher classes for the Ingredient Knowledge Base — e.g. "this text pattern has appeared, unresolved, across 40 scans; consider adding it as a matcher." This is a genuinely good long-term direction and the data to support it is already being captured today, but it's an IKB-authoring tool for the team maintaining `actives.json`, not a user-facing feature — scoped here as a future internal tool, not part of the consumer product surface.

---

## Summary table

| Idea | Bucket | Architecture impact |
|---|---|---|
| Compare multiple products | Near Future | None — new consumer of Similarity |
| Wishlist | **MVP** (moved from Near Future — see `01-entry-points.md` §1, §6) | None — new status field only |
| Share analysis | Near Future | None — existing export pattern, smaller scope |
| Store mode | Long-term | None — presentation variant |
| Dermatologist/consultant mode | Long-term | Likely — Product Profile is currently user-agnostic by design |
| AI explanations | Long-term | Yes — trades the closed-vocabulary explainability guarantee for open generation; needs its own RFC |
| Ingredient learning | Long-term | None for the app; an internal IKB-authoring tool built on already-captured data |
