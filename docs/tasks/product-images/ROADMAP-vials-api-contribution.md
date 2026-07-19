# Roadmap proposal — Vials API & community contribution, decided as one piece

**Type:** roadmap / product decision. **Not a code ticket** — nothing here should
be implemented by picking this up in an implementation task.
**Raised:** 2026-07-19, out of the product-images series (task 04).
**Status:** PROPOSAL — awaiting a decision from whoever owns the product and
backend roadmap.

## Purpose of this document

To prevent this from being re-litigated from scratch. Three separate pieces of
work keep being discovered independently, each blocked on the same missing
thing, and each one is currently being reasoned about in isolation:

1. **US-3 / US-22 crowdsourcing** — submitting manually-added products to a
   shared database (`POST /api/v1/products/suggest`, `pending` review).
2. **Photo evidence for contributions** — product-images task 04; user photos
   as provenance for crowdsourced records.
3. **Moderation workflow + staffing** — formerly PRD §6, retired 2026-07-19 as
   moot (you cannot staff review for a service that doesn't exist).

These are **one piece of work**, not three. They share a backend, an auth model,
an abuse surface, and a moderation queue. Deciding them separately produces an
incoherent design — which is precisely how task 04 ended up implementing an
upload to a storage bucket belonging to a superseded architecture.

## Current state (verified 2026-07-19)

- **There is no Vials API.** `docs/PRD_Spec.md` sync note (2026-07-07): "there
  is no such API". §4.3: the suggest pipeline is "not built".
- `EXPO_PUBLIC_VIALS_API_URL` is absent from `.env.example`;
  `src/services/vialsApi/client.ts` (planned in `IMPLEMENTATION_PLAN.md` Phase
  0) was never created.
- The product corpus is a **pull-only, read-only Turso/libSQL replica**. The app
  cannot write to it, by design.
- **No object storage exists anywhere in the stack.** Turso replaced Supabase as
  the database; nothing replaced Supabase Storage.
- Client-side consequences are already applied: contribution UI gated off
  (`COMMUNITY_CONTRIBUTION_ENABLED`), `suggestProductInBackground` returns
  early, US-3/US-22 ACs marked blocked, PRD §6 item retired.

## The proposal

**If and when a Vials API is greenlit, decide these together, in one piece of
work:**

1. **Transport for contributions and photo upload — recommend Option A**
   (from the task-04 analysis, `BLOCKERS.md` BLOCKER-1): the Vials API owns
   upload. The client POSTs to the API; the server stores bytes in whatever
   object store it chooses and writes the contribution row. The app never holds
   storage credentials.
   - *Option B (presigned PUT)* is a reasonable variant if proxying bytes is a
     cost concern; the client contract barely differs.
   - *Option C (direct-to-storage with an anon key in the client)* is **not
     recommended** — it requires shipping a write-capable credential, and the
     RLS that was supposed to contain that in the old design has no Turso
     equivalent.

2. **Access control — the gate lives at the API tier, not the database.**
   Turso/libSQL has no row-level security; it offers per-database read-only /
   read-write tokens and database-per-tenant isolation, neither of which is
   row-level. So:
   - Contributions land in a **separate server-side database the client replica
     never syncs**.
   - The corpus replica keeps its read-only token and contains **only approved
     rows**.
   - Moderation is an explicit **server-side promotion job** (contributions DB →
     corpus DB), not a row-visibility policy.
   - This is stronger than the RLS design it replaces: unapproved content is
     *physically absent* from the client's database rather than hidden by
     policy.

3. **Moderation workflow and staffing** — the question retired from PRD §6.
   Volume expectations, review SLA, who reviews, and what happens to rejected
   submissions. Note the related licensing constraint already on record: today's
   corpus is 100% `obf_import` ODbL dogfood data that must be purged before
   public release (`handoff/INTEGRATION_GUIDE.md` §7), so "approved community
   content" interacts with the corpus-ownership cutover.

4. **Anonymity constraint (already an architecture rule).** No user identity may
   accompany a contribution — no device ids, no profile data in payloads,
   paths, or metadata. This makes abuse prevention a rate-limiting/heuristics
   problem at the API tier rather than an identity problem, and that needs to be
   designed in, not bolted on.

## If the answer is "no" / "not now"

That is a legitimate outcome and the current state already reflects it
coherently:

- Local product photos (product-images tasks 01–03) are **shipped and complete**
  — capture, document-directory storage, thumbnails on both cards, form attach,
  fully offline. This is a real unit of user value with no backend dependency.
- Community contribution is gated off with no false-success UX.
- US-3/US-22 crowdsourcing ACs are marked blocked and visible to phase planning.

In that case the recommended follow-up is a **cleanup pass**, not more building:
remove or explicitly document-as-dormant the `suggestProduct` client and the
`communityContributionCount` setting, so the codebase stops carrying outbound
machinery for a service that isn't coming.

## Related documents

- `docs/tasks/product-images/BLOCKERS.md` — BLOCKER-1 (no destination) and
  BLOCKER-2 (no API), with the full evidence trail.
- `docs/tasks/product-images/TICKET-docs-pre-turso-architecture.md` — the stale
  pre-Turso docs that caused task 04's wrong turn. Worth resolving regardless of
  this decision.
- `handoff/INTEGRATION_GUIDE.md` — the as-built corpus architecture.
