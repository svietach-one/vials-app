Status: DESIGNED
Tech Design: docs/tech-design/corpus-duplicate-rows.md
Code: — (investigation + docs only, no app code changed; stayed on feature/ocr-improvement per
instructions, no branch created for this task)

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [ ] QA tests (qa-lead)
- [ ] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Scope
Investigation-only task: quantify and root-cause the duplicate-product-row problem in the live
Turso corpus (`products` table), surfaced incidentally by the unrelated `ocr-improvement` task.
No fix is implemented here — see `docs/specs/corpus-duplicate-rows.md` §3 (Non-Goals) and
`docs/tech-design/corpus-duplicate-rows.md` §3 (Implementation Tasks, intentionally empty pending
open questions). Next step for this task is a human/product decision on the open questions below,
not qa-lead/engineer — do not advance this task's phase without that decision.

## Log
- 2026-08-23: Task opened per explicit human request, relayed via the `ocr-improvement` task's
  Step 2 log entry ("corpus-duplicate-row artifacts", `progress/ocr-improvement.md`): 4 of 11
  investigated search-quality cases (`t003`, `t004`, `t011`, `c006`, all CeraVe) turned out to be
  two different corpus rows with identical brand+name text competing for one query, not a search
  bug. Human direction: "that's a data problem, not a search problem" — open as its own tracked
  task. Read `CLAUDE.md`, `progress/ocr-improvement.md` in full (both log entries, all 6 step
  files' summary via `00-README.md`), `handoff/{seed_obf.py, corpus_schema.sql, DATA_PIPELINE.md,
  INTEGRATION_GUIDE.md, README.md}`, and `docs/database/{db-update-log-2026-07-25.md,
  db-setup-guide.md}` + `docs/tech-design/vials-db-schema-v2.1-changes.md` for pipeline/schema
  context. No `.claude/rules/team-context.md` present.

  **Investigation method:** wrote a standalone, read-only Node script in the session scratchpad
  (not committed, not under the repo) mirroring `src/services/turso/httpClient.ts`'s wire
  protocol (`POST {origin}/v2/pipeline`), using the existing read-only `EXPO_PUBLIC_TURSO_TOKEN`
  from `.env.local`. Did not import or modify `src/services/corpus/*` or `scripts/search-eval/*`,
  per instructions — only read those for the access-pattern reference already cited in the task
  brief. No row was written; no branch created; nothing committed.

  **Headline numbers** (full detail + reference queries in `docs/specs/corpus-duplicate-rows.md`
  §6): 21,084 total products (17,342 `obf_import` + 3,742 `vials_seed`). Grouping by the existing
  `search_norm` column finds 439 duplicate groups / 1,093 rows / 654 excess rows. The `barcode`
  partial-unique index has zero live violations (true barcode dupes are confirmed structurally
  impossible, as the task brief predicted). Only 2 of 1,093 duplicate-group rows have a NULL
  barcode — NULL-barcode is *not* the duplication mechanism, contrary to my initial hypothesis
  formed from reading `seed_obf.py` in isolation. 414 of 439 groups are `obf_import`-only, 24 are
  `vials_seed`-only, 1 is genuinely cross-source. 91 of 439 groups (194 excess rows) are a
  distinct, separate phenomenon — `brand IS NULL` + a bare generic `name` ("Shampoo" ×17, "Nivea"
  ×13, "Dove" ×11), each row carrying its own different real barcode — i.e. many different real,
  poorly-labeled products, not duplicate imports; explicitly excluded from the "duplicate" count
  as a non-goal. The credible genuine-duplicate set is the 326 "fully branded" groups (427 excess
  rows); within its cleanest 187-pair subset, 115 pairs (61.5%) have near-identical `inci_raw`
  (safe-looking merge candidates) and 72 (38.5%) have meaningfully different `inci_raw` (likely
  real regional/formulation SKU variants sharing one display name — NOT safe to blindly collapse).
  Incidental finding, logged but out of scope: 2 `vials_seed` rows have the literal placeholder
  `name = "Название не найдено"` while `name_lacin`/`url` correctly identify two different real
  products — a `vials_seed` data-entry bug, not duplication.

  **Root-cause hypothesis (confidence: high on the mechanism, medium on the upstream "why"):**
  Duplication is not caused by the importer re-inserting the same row twice — `uid` is globally
  unique by construction and the `barcode` unique index holds with zero violations, so a literal
  double-insert would either be structurally blocked or would require a NULL barcode, which the
  data shows is nearly absent from duplicate groups. Instead, every inspected "fully branded" pair
  has *two different, individually valid* barcodes under identical display text. `seed_obf.py`
  only de-duplicates in-memory, within a single run, keyed on exact `barcode` — it has no
  brand+name-text dedup step at all. The most consistent explanation: OBF's own upstream
  crowd-sourced dataset already lists the same named product under 2+ distinct real barcodes
  (regional SKU variants, repeat community submissions), and the importer faithfully creates one
  Vials row per distinct OBF barcode entry, with nothing downstream ever reconciling
  same-name-different-barcode rows. Confidence is high on "this is the mechanism, not a
  double-import bug" (directly evidenced) and medium on "this is OBF's own data doing it" (can't
  fully verify without the raw ~1-2 GB OBF JSONL dump, which isn't present locally). Confirmed
  separately, directly in the data: the `docs/database/db-update-log-2026-07-25.md`'s "2 held"
  unresolved `vials_seed`/`obf_import` barcode collisions from the 2026-07-25 xlsx import — found
  one of the two live in the corpus (`the ordinary granactive retinoid 2% emulsion`: `obf_import`
  row keeps its real barcode, `vials_seed` row's barcode is NULL, exactly matching "held" as
  described). The second "held" case wasn't found by this investigation's text-matching method,
  most likely because of a name-formatting mismatch between the two sources — flagged as a
  probable undercount of true cross-source duplication in `docs/tech-design/corpus-duplicate-
  rows.md` §4 (Assumptions), not claimed as fully quantified.

  **Verified (not assumed) blast-radius finding:** grepped every consumer of the shelf `Product`
  type's corpus-uid field (`openBeautyFactsId`, `src/types/index.ts:343`). It is populated only
  when `source === 'obf_import'` (`ManualProductFormScreen.tsx:560`, `FirstProductScreen.tsx:75`)
  — always `null` for `vials_seed`/`community` adds — and is never live-refetched from the corpus
  after add (no `getByUid(product.openBeautyFactsId)` call exists anywhere); it's a write-once
  provenance snapshot, read only for edit-form carry-forward and a one-time migration backfill.
  `RoutineStep`/etc. reference the local shelf `Product.id`, never the corpus `uid`, directly —
  correcting the task brief's shorthand ("routines reference products.uid") to what the code
  actually does. `INTEGRATION_GUIDE.md §5` already documents the `obf_import` uid reference as
  expected to go stale (the whole `obf_import` source is deleted wholesale at the pre-release
  cutover), so the real blast radius is narrower than initially assumed, though still real enough
  to flag as a spec acceptance criterion (Story 3) rather than dismiss.

  **Deliverables:** `docs/specs/corpus-duplicate-rows.md` (Status: DRAFT — awaiting human
  review/approval, not yet APPROVED), `docs/tech-design/corpus-duplicate-rows.md` (Implementation
  Tasks section intentionally near-empty — all 4 open questions are Type A/D per the gap-type
  rules and route to a human, mirrored with named role-based owners in both documents' Open
  Questions sections: product owner, corpus/data-pipeline owner, vials_seed data owner). Status
  set to DESIGNED per `.claude/rules/progress.md`'s template — not IMPLEMENTED, nothing was
  fixed. This task should not proceed to qa-lead/engineer until the open questions are answered
  by a human and a follow-up tech design (or a revision of this one) defines an actual fix.
