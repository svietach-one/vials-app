# Blockers — product-images task series

## BLOCKER-1 — Contributed product photos have no server destination

**Raised:** 2026-07-19, during task 04 implementation.
**Status:** OPEN — task 04 halted and its client code reverted.
**Blocks:** task 04 only. Tasks 01–03 shipped and are unaffected.
**Needs:** a backend/product decision, not a client-side fix.

### Summary

Task 04 specified uploading contributed photos to **Supabase Storage** (bucket
`product-images`). That target is inherited from the **superseded pre-Turso
architecture**. Investigating the delivered stack showed the problem is deeper
than a wrong vendor: **there is nowhere for a contributed photo to go at all.**

### What the delivered architecture actually provides

| Aspect | Reality (verified in code) |
|---|---|
| Turso client | `expo-sqlite`'s built-in libSQL mode — no `@libsql/client` dep |
| Wiring | `src/providers/CorpusProvider.tsx` opens `vials_corpus.db` via `libSQLOptions` |
| Sync direction | **Pull only** — `syncCorpus()` → `syncLibSQL()`. No push exists |
| Token | **Read-only by contract** — `.env.example`: `turso db tokens create vials-corpus --read-only` |
| Writes | None. Corpus repositories are SELECT-only |
| Schema | `handoff/corpus_schema.sql` v2.1: `ingredients`, `products`, `product_tags` (+ FTS) |

`handoff/INTEGRATION_GUIDE.md` states the invariant directly: *"The app never
writes to the corpus. Contributions (future) go through a separate endpoint,
not the replica. The replica uses a read-only auth token."*

### The three gaps

1. **No write path.** The corpus is a pull-only embedded replica behind a
   read-only token. This is by design, not an oversight — writing to it would
   break the invariant above.
2. **No object storage anywhere in the stack.** Turso is SQLite; it has no blob
   store. Turso replaced Supabase as the *database*, but **nothing replaced
   Supabase Storage.** Photo bytes have no home regardless of DB choice.
3. **No addressable suggestion.** `suggestProduct` POSTs to
   `EXPO_PUBLIC_VIALS_API_URL` and returns `void` — no id to attach a photo to.
   That env var **is not in `.env.example`**, so the Vials API's existence is
   itself unconfirmed (see BLOCKER-2).

### Access control: what replaces Supabase RLS

RLS did real work in the old design — gating anon INSERT into `contributions/*`
and hiding `pending_review` rows until moderated. **Turso/libSQL has no
row-level equivalent.** It offers only coarser controls: per-database
read-only/read-write tokens, and database-per-tenant isolation. Neither is
row-level.

So the replacement is **architectural — the gate moves from the database to the
API tier:**

- Contributions land in a **separate server-side database the client replica
  never syncs**. The corpus replica keeps its read-only token and contains
  **only approved rows**.
- Moderation becomes an explicit **server-side promotion job** (contributions DB
  → corpus DB) rather than a row-visibility policy.
- Write authorization is an API concern (rate limiting / anti-abuse, since
  contributions must stay anonymous per the architecture rule) — not a database
  concern.

This is a stronger posture than RLS: unapproved content is **physically absent**
from the client's database rather than hidden by policy, and the client never
holds a write-capable credential.

### Candidate designs (for whoever owns the backend)

- **A — Vials API owns upload (recommended).** Client POSTs multipart to the
  Vials API; the server stores bytes in whatever object store it chooses (an
  implementation detail *behind* the API) and writes a contributions row. The
  app holds no storage credentials.
- **B — Presigned upload.** API issues a short-lived PUT URL; the client uploads
  directly, then calls back with the key. Better for large files; still no
  long-lived client secret.
- **C — Direct-to-storage with an anon key** (what task 04 attempted). Requires
  shipping a **write-capable credential in the client** — precisely what RLS
  existed to contain, and there is no RLS now. **Not recommended.**

### State of the client code

Reverted: the Supabase client, the Supabase transport, the `linkPhotoEvidence`
stub, and `SuggestPayload.photo_evidence_url` (a phantom contract for an
endpoint that does not exist).

Kept, because it is backend-agnostic and survives any of A/B/C:

- `PhotoUploadTransport` — the pluggable seam a real transport drops into.
- Queue hardening in `src/services/photoUploadQueue.ts`: 5-attempt cap,
  30-day pending-file TTL cleanup, `failed` marker.
- `noopTransport` stays wired, so nothing uploads and nothing throws.

Deliberately **not** kept: the two-step upload→link drain. With no linking
endpoint, a transport wired without a link implementation would leave every
entry uncleared and grow the queue forever. `drain` is single-step until a real
endpoint exists.

### What must be true before task 04 can resume

- A decided upload target (API endpoint vs. presigned storage) and who owns
  moderation of the pending queue.
- A way to address a submitted suggestion — an id returned by
  `POST /api/v1/products/suggest`, or a productId-keyed endpoint.
- Resolution of BLOCKER-2.

---

## BLOCKER-2 — There is no Vials API; US-3 has no destination at all

**Raised:** 2026-07-19. **Confirmed** the same day against the PRD.
**Status:** OPEN — needs a product decision, not a backend ETA.
**Severity:** product-level gap, wider than the product-images series.

Every candidate design in BLOCKER-1 assumes a Vials API that can receive an
upload. **That API does not exist, and the PRD says so explicitly.**

### Primary evidence — the PRD's own audit

`docs/PRD_Spec.md`, sync note (2026-07-07):

> Corrected the "proprietary Vials API / self-hosted PostgreSQL" description —
> **there is no such API.** Product data source is **only the Vials corpus**: a
> Turso/libSQL replica pulled onto the device and queried entirely locally.

§4.3 restates it:

> **There is no Vials REST API and no PostgreSQL backend in the request path**;
> reads never leave the device.

And on the contribution pipeline specifically:

> Background submission of manually-added products back to a shared/community
> database (`POST /api/v1/products/suggest`, `pending` review) is **not built**
> — the corpus schema reserves a `'community'` source value for this, but the
> submission pipeline doesn't exist yet.

### Corroborating signals

- `EXPO_PUBLIC_VIALS_API_URL` is **absent from `.env.example`**, which otherwise
  documents every env var the app reads.
- `src/services/vialsApi/products.ts` treats an unset base URL as normal and
  returns silently — a missing backend is invisible at runtime **by design**.
- `src/services/vialsApi/client.ts` (the base fetch client
  `IMPLEMENTATION_PLAN.md` §Phase 0 calls for) **was never created**; only
  `products.ts` exists.
- `docs/database/db-product-spec.md`: US-3 is "schema-only … not wired into a
  screen yet."

### The contradiction to resolve

The docs simultaneously assert both of these:

- **PRD §4.3 / sync note:** there is no Vials API and the submission pipeline
  does not exist.
- **PRD §6 Open Items:** *"Confirm the Vials API moderation queue workflow
  (admin review of `pending` crowdsourced suggestions) is defined and staffed
  before launch."*

An open item presumes the thing it gates will exist. Meanwhile the codebase
already ships a client (`suggestProduct`) that POSTs to it and silently no-ops.
So the app carries dead outbound machinery for a service the PRD says was never
built.

### Consequence

Community photo contribution has **no destination regardless of which
client-side design is chosen**. US-3's acceptance criteria are currently
unsatisfiable — this is a product-roadmap gap, not a task-04 scoping problem.
Any further client work here would build against a service that may never
arrive.

### Ask — for whoever owns the product/backend roadmap

1. Is a Vials API (or any contribution endpoint) actually planned, and when?
2. If **yes** — BLOCKER-1's design choice (API-owned upload vs presigned PUT)
   should be made at the same time, since photo upload and product suggestion
   are the same pipeline.
3. If **no** — US-3 and photo contribution should be **explicitly deferred**,
   PRD §6's moderation-queue open item retired or reworded, and the existing
   `suggestProduct` client either removed or documented as dormant. Tasks 01–03
   (local photos, fully functional offline) then stand as the complete
   delivered scope, which is a coherent product on its own.

---

## Related, tracked separately

`docs/tasks/product-images/TICKET-docs-pre-turso-architecture.md` — the DB docs
still describe the pre-Turso Supabase architecture in their bodies, and the
unused `@supabase/supabase-js` dependency is still installed. That stale trail
is what led task 04 to Supabase in the first place, and other tasks can hit it.
