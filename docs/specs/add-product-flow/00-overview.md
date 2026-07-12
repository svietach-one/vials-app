# Add Product Wizard — Task 00: Overview

Feature: `add-product-accordion-wizard`. Replaces the multi-screen
"Universal Scanner → ProductForm" flow with a single scrollable accordion
screen containing four collapsible sections. Camera-driven capture (label
OCR, barcode, INCI OCR) happens in full-screen modal overlays launched from
inside a section; the modal returns parsed data via callback and closes.

Read this file first, then work through the numbered task files in this
folder **in order**. Each file is self-contained — it names its own
dependencies and can be given to Claude Code as its own prompt/session.
Don't load all files into context at once; do them one at a time.

## Task file order

1. `01-types.md` — type definitions (do first, everything depends on it)
2. `02-form-reducer.md` — the draft state reducer
3. `03-parsing-utils.md` — deterministic parsing utilities (no AI/LLM)
4. `04-camera-modal.md` — reusable camera capture modal
5. `05-inci-notice.md` — mandatory pre-scan language notice
6. `06-accordion-shell.md` — generic SectionAccordion + SaveBar
7. `07-section-components.md` — the four section components
8. `08-screen-assembly.md` — AddProductScreen wiring it all together
9. `09-save-and-sync.md` — local-first save + background suggest sync
10. `10-testing-checklist.md` — all-states coverage + QA pass

## Non-negotiable constraints (apply across every task file)

- **No AI/LLM anywhere in this feature.** All parsing is deterministic:
  string prefix/contains matching, regex keyword maps, static lookup
  tables. OCR itself (ML Kit) just returns raw text strings — everything
  downstream of that is plain string logic.
- **Local-first save.** Tapping "Save and put on shelf" writes
  synchronously to `productsStore` and closes the screen immediately.
  `POST /api/v1/products/suggest` fires after, unawaited, never blocking
  or gating any UI state.
- **Privacy boundary.** Opening date and PAO never leave the device. Only
  brand, name, category, barcode, and raw INCI text are eligible for the
  background suggest payload.
- **One reusable camera modal**, parameterized by `mode: 'label' |
  'barcode' | 'inci'` — not three separate modal components.
- **INCI scan requires a pre-scan notice** telling the user to scan the
  original Latin-character ingredients list, not a translated sticker.
  This is a hard requirement, not optional polish.
- Every section must be editable at any time by tapping its collapsed
  summary row — no "Back" navigation anywhere in this flow.

## Existing project context to reference

- `IMPLEMENTATION_PLAN.md` — Phase 4 (Catalog Screen), architecture
  constraints (stores never call `ConflictEngine`, AsyncStorage/SQLite
  persistence, no AI in Phase 1 MVP)
- `SCREENS.md` §3 — Catalog screen and Apothecary color system
- `USER_STORIES.md` US-22 — acceptance criteria this flow must satisfy
- `db-tech-design.md` §5.3, §6 — background contribution pattern (silent
  swallow on error) and local SQLite query patterns to reuse for brand
  autocomplete
- `src/services/vialsApi/products.ts` — existing `lookupBarcode`,
  `searchByText`, `suggestProduct` exports; this feature adds no new
  server-facing API surface

## Out of scope

- Changes to `ConflictEngine.ts` itself
- A true cross-device "community scans" counter (use a local per-device
  count instead, see `07-section-components.md`)
- Editing an existing catalog product (creation flow only)
- The barcode-hit / product-found path (unchanged by this work)
