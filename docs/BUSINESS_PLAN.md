# Vials — Business Plan

**Version:** 1.0
**Status:** DRAFT
**Author:** Product Director / CBO analysis
**Date:** 2026-07-06

---

## 1. Executive Summary

Vials is not a consumer skincare app with a data byproduct. It is a **regional cosmetic
data company** whose free consumer app is the sensor network that builds the asset.

- **The asset:** Vials DB — a fully proprietary, independently built database of
  cosmetic products and normalized INCI data, focused on three underserved,
  high-growth segments: Polish mass-market/indie brands, Belarusian cosmetics,
  and K-Beauty with localized EU sticker labels.
- **The engine:** on-device OCR scanning + automated INCI normalization +
  crowdsourced contribution, so the database self-populates and self-heals.
- **The model:** the consumer core (scanning, virtual shelf, routines, conflict
  warnings) is free forever — it is the cost of data acquisition, not a loss
  leader. Margin comes from a B2C premium layer and, primarily, B2B data products.

**Key architectural decision:** Vials DB is built **without Open Beauty Facts**.
No OBF records are imported, merged, or seeded — not even as a fallback corpus.
This costs us catalog breadth in the first months and buys us a legally clean,
fully sellable asset (OBF's ODbL share-alike license would otherwise force us to
open any derivative database, killing the B2B data business). Every record in
Vials DB is born from our own pipeline with full provenance.

---

## 2. The Core Asset: Vials DB

### 2.1 Why this data wins

Global databases (OBF, INCIDecoder, commercial PIM feeds) are structurally weak
exactly where we focus:

| Segment | Gap in global sources | Our advantage |
|---|---|---|
| Polish brands (Ziaja, Bielenda, Tołpa) | Sparse coverage, stale reformulations | Users re-scan Rossmann/Hebe shelves weekly |
| Belarusian brands (Belita, Vitex, Modum) | Essentially absent | Only structured source, period |
| K-Beauty in EU (Cosrx, Beauty of Joseon, Round Lab) | EU distributor sticker overlays defeat generic scanners; Korean label ≠ EU INCI | OCR reads the sticker *and* the label; we capture both |

The durable moat is not the snapshot — snapshots get scraped. It is
**change-detection velocity**: thousands of phones re-scanning shelves detect
reformulations, sticker corrections, and new SKUs faster than any panel,
scraper, or brand self-report. The sellable product is the *diff*, not the dump.

### 2.2 Non-negotiable data hygiene (from record #1)

These cannot be retrofitted; every B2B buyer's due diligence will test them:

1. **Clean provenance on every record** — source (user scan / brand-submitted /
   manual curation), scan count, last-verified date, photo evidence, confidence
   score. Provenance is what lets us charge API prices instead of CSV prices.
2. **Contribution rights in the ToS** from the first scan: user submissions are
   licensed to Vials for commercial use. Retroactive fixes are impossible.
3. **No third-party database contamination.** No OBF, no scraped retailer feeds
   merged into the canonical store. Brand-submitted data comes with explicit
   license terms.
4. **GDPR-clean aggregation designed into the pipeline** — scan behavior is
   personal data until properly anonymized; B2B products only ever see
   aggregates.

### 2.3 Cold start without OBF

The empty-catalog risk is solved by three cheap sources, not by imports:

1. **Top-500 SKU blitz.** The Rossmann + Hebe skincare shelf plus top K-Beauty
   SKUs at Polish e-tailers is a finite list. Two people with phones and our own
   OCR pipeline seed the core catalog in 2–3 weeks. ~500 correct SKUs cover an
   estimated 70–80% of real user scans.
2. **Brand-direct data.** Indie brands submit verified INCI themselves — clean
   data, clean rights, and simultaneously the top of the B2B funnel (see §5.2).
3. **"Not found" as a feature.** The empty result is a contribution moment:
   *"You're the first to scan this — add it to Vials DB."* First-scanner credit
   turns a failure state into the growth mechanic.

**North-star data metrics:** % of user scans answered by Vials DB;
% coverage of the Rossmann/Hebe skincare shelf; count of sticker-resolved
K-Beauty SKUs; median days-to-detect a reformulation.

---

## 3. Product Strategy: Free Core, Daily Habit

### 3.1 The free line (never paywalled)

Scanning and ingredient recognition, the virtual shelf, routine building,
conflict/safety warnings, PAO & expiry tracking. Anything about the **present
state** of the user's skincare stays free. This drives hyper-growth, community
loyalty, and — critically — scan volume, which *is* the data business.

### 3.2 Retention: from "routine analyzer" to daily habit

Daily use comes from things that **decay over time**, because decay creates a
reason to return:

1. **PAO/expiry notifications** — "your vitamin C opened 2.5 months ago,
   potency dropping." Legitimate, non-spammy, and a built-in purchase-intent
   moment.
2. **Clinical rehab countdowns** — post-procedure users (Botox, fillers) check
   daily by necessity; nobody else does "3 days until retinol is safe again."
3. **Skin diary photo log** — weekly prompt, private, on-device. Builds the
   longitudinal dataset that premium skin-cycle analytics later monetizes.
4. **Replenishment prediction** — usage frequency × routine steps → "runs out
   ~July 20." Utility first, affiliate hook second.
5. **Seasonal routine transitions** — four guaranteed re-engagement moments per
   year, plus weather-day variants.

### 3.3 Organic acquisition: "the only scanner that reads the sticker"

Our marketing asset is a demonstrable failure of every competitor:

- **The sticker test.** Short-video format: a generic scanner fails on a Cosrx
  bottle with a Polish distributor sticker → Vials reads it and flags a conflict
  with the user's retinol. Fifteen seconds, natively UGC, seeded with ~10 Polish
  beauty micro-creators.
- **Programmatic SEO from the ledger.** Every canonical SKU becomes a public
  Polish-language page (ingredients, actives explained, conflict notes,
  reformulation history). INCIDecoder is weak in Polish and absent on BY brands;
  we own the long tail of "skład [product]" queries. Every page CTA: scan it in
  the app. The database markets itself.
- **Contribution as identity.** First-scanner credit shown on the public SKU
  page; monthly "unscannable product" bounty. OCR failures become training data
  and community lore simultaneously.
- **Channels:** Polish beauty Facebook groups and K-Beauty PL communities first
  (dense K-Beauty import market, zero localized ingredient tools), Belarus
  second via Belita/Vitex coverage no global app has.

---

## 4. Monetization — B2C Premium ("Vials Pro")

Sell **foresight, exports, and multi-person** — never the present.

| Feature | Willingness-to-pay driver |
|---|---|
| Skin-cycle & progress analytics (diary + routine + procedures correlated) | Answers "is this actually working?" |
| Aesthetic doctor report export (PDF: routine, actives, procedure history) | Saves an awkward clinic conversation; doctors start requesting it — free B2B distribution |
| Multi-profile (family; consultants managing clients) | Prosumer tier for cosmetologists at consumer price |
| Pregnancy/breastfeeding safety mode + prescription-active depth | Acute, time-boxed, high-stakes |
| Advanced procedure planner (treatment stacking, sequencing) | Clinical users already spend €200+/visit |

Anchor pricing: **€3.99/month or €29.99/year**, PPP-adjusted for PL/BY.
Role in the model: margin garnish and retention proof — the engine is B2B.

---

## 5. Monetization — B2B Data Products (the economic engine)

Because Vials DB is fully proprietary, every product below is legally sellable.

### 5.1 Product lineup (ordered by sales-cycle length)

| Product | Buyer | Offer | Pricing shape |
|---|---|---|---|
| **K-Beauty EU Compliance Gap Audit** | K-Beauty importers/distributors | Where the Korean label, EU sticker, and actual INCI disagree (EU Reg. 1223/2009 exposure, 26 labeled allergens) | €20–50 per SKU + recurring re-audit |
| **Reformulation Alert Feed** | Distributors, importers, private label | Event stream: "SKU X reformulated ~June 2026; delta: +phenoxyethanol, −parfum," with scan evidence | €500–2k/mo per watchlist |
| **Attribute Enrichment API** | E-commerce (Notino, Allegro, Hebe online) | Canonical INCI, active tags, facet data (fragrance-free / vegan / pregnancy-safe) for product pages and filters | €0.05–0.15 per SKU-month |
| **Regional Trend Panels** | Market research (Mintel, NielsenIQ), manufacturers | Aggregated, anonymized active-ingredient adoption and routine co-occurrence for PL/BY | €5–15k per quarterly report, then API |

The **compliance audit is the wedge**: importers genuinely fear label-mismatch
liability, the buyer is a small ops team (fast close), and we are the only
entity photographing both the sticker and the underlying label at scale. Land
with audits, expand into the feed.

**Deferred:** medical/allergy networks (patch-test cross-referencing) — highest
value, 24-month+ sales cycle, clinical-validation burden. Investor-deck
material, not roadmap material.

### 5.2 Indie Brand Pro-Platform

Polish indie skincare is exploding and starved for trust signals. Offer:
verified-INCI badge, claimed brand page, "how your products appear in routines
and conflict checks" analytics. €50–150/month per brand. The conflict engine
makes verification *mean something* — a wedge no retailer has. Brand-submitted
INCI also feeds the database (clean rights, zero collection cost).

### 5.3 Leverage with retail (Rossmann, Hebe, Notino, Mila, Oz)

We approach retailers as a **data vendor who also delivers purchase-intent
traffic** — not as an affiliate supplicant. Affiliate commission is the
sweetener inside a data deal, not the deal. In Belarus (Oz, Mila), where
affiliate programs may not exist, we are the only structured skincare-intent
channel — direct partnership terms.

### 5.4 The trust firewall (non-negotiable)

**Never sell write-access upstream.** No brand or retailer can pay to alter a
conflict warning, a safety flag, or product-page content. Consumer trust →
scan volume → data quality → B2B revenue; one paid placement inside the safety
layer breaks the whole chain. We sell the ledger's *output* downstream, never
influence over it.

---

## 6. Roadmap — Three Stages

### Stage 1 (months 0–6): Instrument the ledger, prove the sensor network

- Contribution pipeline live with ToS rights + provenance fields.
- Top-500 SKU seeding blitz; brand-direct submissions open.
- Public SKU pages (programmatic SEO engine on).
- Sticker-test creator seeding in PL communities.
- Affiliate links live — revenue is trivial; the point is the **intent
  dataset** (which SKUs drive click-outs) as Stage 2 pitch material.
- Concierge brand-verification pilot: manually pitch 5 Polish indie brands at
  €99/month (verified badge + hand-assembled monthly insight PDF). Success
  gate: 2 of 5 sign → the Pro-Platform is validated before building it.
- Pro fake-door + price probe (waitlist + feature ranking survey). Success
  gate: >5% of MAU open, >25% of those leave an email.

**Exit criteria:** ≥70% Rossmann/Hebe skincare-shelf coverage; 1,000+
sticker-resolved K-Beauty SKUs; ≥60% of scans answered by Vials DB.

### Stage 2 (months 6–12): First data revenue, smallest buyers first

- K-Beauty compliance audits sold (fastest close).
- Reformulation feed to 3–5 importers/distributors.
- First enrichment-API pilot with one e-tailer, pitched with our own evidence:
  "N thousand users viewed these SKUs in-app; here is the attribute data your
  product pages are missing."
- Vials Pro ships — build only the fake-door's top-voted feature first (likely
  doctor export: smallest build, sharpest differentiation, viral into clinics).

**Exit criteria:** €10–20k MRR from data products; one signed retailer pilot.

### Stage 3 (months 12–18): Platform pricing

- Trend panels to market research firms and manufacturers — by now the
  longitudinal history exists and **cannot be bought or reconstructed
  retroactively** by any competitor.
- Self-serve brand platform replaces the concierge pilot.
- Enrichment API generalized with published pricing.
- Fundraising window: "proprietary regional data ledger with a self-healing
  collection network and B2B revenue" prices at a data-infrastructure multiple,
  not a consumer-app multiple.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Cold start: empty-catalog frustration pre-seeding | Top-500 blitz before launch marketing; "not found" designed as contribution moment; manual entry with INCI autocomplete always available |
| Crowdsourced data quality | Schema validation gates, multi-scan confirmation, confidence scores, moderation queue for first-seen SKUs |
| A competitor copies the model | They start 12–18 months behind on longitudinal history and community; change-velocity moat compounds |
| GDPR exposure in B2B products | Aggregation-only exports, anonymization in the pipeline (not bolted on), DPIA before first data sale |
| Regulatory sensitivity of safety claims | Conflict warnings framed as ingredient-interaction information, not medical advice; clinical layer reviewed with an aesthetic-medicine advisor |
| Monetizing attention (ads, sponsored placements) — the trap | Structurally banned by §5.4; revenue only from utility (users), verification (brands), and intent/data (retailers, B2B) |

---

## 8. What We Deliberately Do NOT Do

- No Open Beauty Facts data — not imported, not seeded, not merged. Runtime
  independence from day one; license purity is worth more than three months of
  catalog breadth.
- No paywall on scanning, shelf, routines, or safety warnings — ever.
- No ads, no sponsored product placements, no paid alterations to safety output.
- No medical/allergy B2B vertical before year 2.
- No global-market ambition before PL/BY/K-Beauty dominance — the moat is
  regional depth, not breadth.
