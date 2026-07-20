# Blockers — product-images task series

> **BLOCKER-1 and BLOCKER-2 are RESOLVED (2026-07-19)** by the second-Turso-database
> design recorded below. Both original write-ups are retained under
> "Resolved blockers" for the reasoning trail — they explain why the obvious
> paths (Supabase Storage, writing to the corpus) are wrong, which is still
> load-bearing context for anyone extending this.

## RESOLUTION — contributions go to a second Turso database

**Decided and implemented:** 2026-07-19. Replaces the deferred "Vials API".

Product suggestions are written **directly into a separate Turso database**
(`vials-contributions`) from the client. No API server, no object storage, no
moderation dashboard.

### Design

| Concern | Resolution |
|---|---|
| Where rows go | `vials-contributions` Turso DB, table `contributions`, `status='pending_review'` |
| Where photos go | `photo_blob BLOB` in the same row — ~1200px JPEG q0.7, ~100–150 KB |
| Corpus safety | Untouched. It stays a **pull-only, read-only** replica; the app still never writes to it |
| Moderation | **Manual SQL** by a human: review `pending_review`, INSERT approved rows into the corpus, mark handled. Queries in `docs/database/contributions_schema.sql` |
| Retry/offline | **None by design.** The write is awaited and its outcome surfaced; the user retries by hand |

### What replaces Supabase RLS — answered

The gate is **structural, not a policy**: unapproved submissions live in a
*different database* that the client's corpus replica never syncs. Unapproved
content is therefore **physically absent** from the client rather than hidden
by a row-visibility rule. Promotion into the corpus is an explicit human step.

### Token scoping — narrower than expected, and used

Turso supports **fine-grained per-table, per-operation** tokens, not just
read-only/full-access. The client token is provisioned at the narrowest scope
available:

```
turso db tokens create vials-contributions -p contributions:data_add --expiration 90d
```

`contributions:data_add` = INSERT-only, one table, one database. It **cannot**
read rows back, update, delete, or alter schema. Enforced in code by
`src/services/contributionsDb.ts`, which reads only the
`EXPO_PUBLIC_TURSO_CONTRIBUTIONS_*` pair — the corpus read token never appears
in that module and the two are never combined into one config object.

Note `remoteOnly: true` is **required**, not a preference: an embedded replica
syncs by *reading* the primary, which an insert-only token cannot do.

### Accepted limitations (deliberate, for MVP)

1. **The write token ships in the client bundle.** `EXPO_PUBLIC_*` values are
   inlined into JS and are extractable from a shipped app. `data_add`-only
   contains the blast radius (no reads of others' submissions, no deletes, no
   schema changes), but nothing prevents an extracted token from inserting spam
   rows or oversized blobs — there is no server to rate-limit. Mitigations if
   this becomes real: rotate the token (`--expiration` is already set), or move
   the write behind a server, which is the thing this design exists to avoid.
2. **Sharing does not work in every build.** The libSQL native module is absent
   from Expo Go and from bundled-corpus builds (`app.config.js` compiles
   expo-sqlite with `useLibSQL: false` when `VIALS_CORPUS_BUNDLED=1`). The app
   reports this as a distinct **`unavailable`** state — not a failure the user
   could retry — and the local shelf save is unaffected. Testing the real write
   path requires a dev/EAS build with libSQL enabled.
3. **No moderation tooling.** Review is raw SQL. Fine at MVP volume; it will
   not scale, and there is no audit trail beyond the `status` column.

### Anonymity — how it is enforced

The bound INSERT parameters are the entire payload: product metadata only. No
profile fields, no device or install identifier. `id` is a fresh row UUID, not
a user handle. Photo bytes come **only** from the image-manipulator re-encode,
which strips all EXIF — so GPS coordinates and device metadata cannot ride
along in the blob. That dependency is load-bearing and commented at
`renderContributionBlob`; reading the original camera file instead would
silently reintroduce location data.

---

## Resolved blockers (retained for reasoning)

## BLOCKER-1 — Contributed product photos have no server destination

**Raised:** 2026-07-19, during task 04 implementation.
**Status:** ✅ RESOLVED 2026-07-19 — photos are now BLOBs in the contributions Turso DB (see RESOLUTION above).
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
**Status:** ✅ RESOLVED 2026-07-19 — superseded, not built. Contributions bypass the API entirely and write to a second Turso database (see RESOLUTION above). The Vials API remains unbuilt and is no longer required for US-3.
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
