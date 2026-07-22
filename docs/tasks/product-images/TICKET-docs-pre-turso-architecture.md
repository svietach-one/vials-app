# Ticket — Docs still describe the pre-Turso architecture

**Slug:** `docs-pre-turso-architecture`
**Raised:** 2026-07-19 (fallout from the product-images series, task 04)
**Type:** documentation + dependency cleanup
**Priority:** medium — actively misleading, already caused one wrong
implementation

## Why this is not just task 04's problem

Task 04 of the product-images series was written against **Supabase Storage**
and implemented before the mismatch was caught. The spec author and the
implementer both followed a trail of documentation that still reads as current.
Any future task touching sync, contributions, product images, or the remote
schema can follow the same trail to the same wrong conclusion.

The correction notes that exist today are **banners on top of unchanged
bodies** — a reader who skims past the banner (or lands mid-document via search
or a section link) gets the superseded design presented as fact.

## Scope

### 1. `docs/database/db-tech-design.md`

Has a superseded banner (2026-07-08), but the **body is entirely the old
design** and needs real correction, not just a warning:

- §1 Architecture Overview — the ASCII diagram shows `Remote Registry
  (Supabase)` with PostgreSQL tables, Edge Functions `/sync` `/contribute`, and
  `Storage bucket: product-images (CDN)`. **This diagram is the direct source of
  task 04's locked decision.**
- §"Remote Registry — Supabase (PostgreSQL + Edge Functions)" — choice rationale
  for a component that was never built.
- §4 "Remote Schema (PostgreSQL via Supabase)" — superseded by
  `handoff/corpus_schema.sql` (SQLite/libSQL, `id INTEGER PK` + `uid TEXT
  UNIQUE`, not UUID PKs).
- Assumptions — "Supabase free tier (500 MB Postgres, 2 GB storage) is
  sufficient for Phase 1".

**Suggested fix:** either replace the body with the delivered Turso/libSQL
design, or move the whole file to an `archive/` path with a pointer to
`handoff/INTEGRATION_GUIDE.md` as the live source. A banner alone has already
proven insufficient.

### 2. `docs/database/db-setup-guide.md`

Also banner-corrected, also stale throughout:

- §"Full Schema (PostgreSQL / Supabase)"
- Supabase REST query examples (`GET /rest/v1/barcodes?...`)
- Edge Function examples (`/functions/v1/match-product`)
- **Day-1 setup checklist** — "Create Supabase project", `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SUPABASE_SERVICE_KEY`,
  `npx expo install expo-sqlite @supabase/supabase-js`, "Add SUPABASE_* keys to
  Expo EAS secrets". A new collaborator following this guide would provision
  infrastructure the project does not use.

Note the guide's env vars **contradict `.env.example`**, which contains no
Supabase vars at all. The env contract is correct; the docs are behind it.

### 3. Remove `@supabase/supabase-js` from `package.json`

- Currently `^2.110.1`, and **imported nowhere in `src/`** (verified by grep).
- `DebugAccountSyncCard` only *mentions* Supabase in comments — it is a mock
  with no import.
- Its presence in `package.json` is a standing signal that "this project uses
  Supabase," which is exactly what made reaching for it in task 04 feel correct.

**Caveat before removing:** `docs/database/db-tech-design.md` notes that Phase 2
plans a *separate* Supabase project for user auth + personal-data cloud sync
(`docs/tech-design/user-auth-cloud-backup.md` — note: that design file does not
currently exist in `docs/tech-design/`). If Phase 2 is imminent, the dependency
may be re-added deliberately, in its own commit, wired to that project. It
should not sit installed-and-unused in the meantime.

### 4. Check for other stale references

`docs/tech-design/routine-similar-product-priority.md` also mentions Supabase —
verify whether it is load-bearing or incidental.

## Acceptance

- No document presents the Supabase Remote Registry as the current architecture
  (corrected in body, or archived with a clear pointer).
- The Day-1 setup checklist provisions **Turso**, matching `.env.example`.
- `@supabase/supabase-js` is removed, or its Phase-2 purpose is documented and
  it is wired to something.
- A reader landing mid-document cannot mistake the old design for the live one.

## Out of scope

The upload-destination decision itself — see
`docs/tasks/product-images/BLOCKERS.md` (BLOCKER-1 and BLOCKER-2).
