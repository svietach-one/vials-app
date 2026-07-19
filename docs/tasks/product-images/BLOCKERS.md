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

## BLOCKER-2 — The Vials API may not exist; US-3 has no destination

**Raised:** 2026-07-19.
**Status:** OPEN — needs an answer from whoever owns the backend roadmap.
**Severity:** product-level gap, wider than the product-images series.

Every candidate design in BLOCKER-1 assumes a Vials API that can receive an
upload. That assumption is unverified:

- `EXPO_PUBLIC_VIALS_API_URL` **is absent from `.env.example`**, which otherwise
  documents every env var the app reads (Anthropic key, both `TURSO_*` vars,
  `CORPUS_MODE`).
- `src/services/vialsApi/products.ts` treats an unset base URL as normal and
  returns silently — so a missing backend is invisible at runtime by design.
- `suggestProduct` is the only endpoint the client calls, and nothing verifies
  it is deployed.
- `docs/database/db-product-spec.md` records that US-3 (community contribution)
  is **"schema-only (`'community'` source value) … not wired into a screen
  yet."**

**Why this matters beyond task 04:** if no contribution endpoint is scheduled,
then community photo contribution has no destination *regardless of which
client-side design is chosen*. That makes US-3's acceptance criteria
unsatisfiable — a product-roadmap gap, not a client scoping problem. Building
more client machinery would leave the app ready for an endpoint that may never
arrive.

**Ask:** confirm whether the Vials API — or at minimum a photo/contribution
upload endpoint — is on the backend roadmap, and by when. If it is not, US-3
should be explicitly deferred and the local-photo feature (tasks 01–03,
already shipped and fully functional offline) documented as the whole of the
delivered scope.

---

## Related, tracked separately

`docs/tasks/product-images/TICKET-docs-pre-turso-architecture.md` — the DB docs
still describe the pre-Turso Supabase architecture in their bodies, and the
unused `@supabase/supabase-js` dependency is still installed. That stale trail
is what led task 04 to Supabase in the first place, and other tasks can hit it.
