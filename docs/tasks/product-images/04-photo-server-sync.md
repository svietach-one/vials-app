# Task 04 — Photo Server Sync (Supabase Storage + Contribution Linking)

**Depends on:** Task 01 (queue + transport interface). Independent of 02/03.
**Prerequisite:** Supabase project credentials available in env
(`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). If they are
NOT available, implement everything, keep `noopTransport` as the wired default
behind an env flag, and record the switch-on step in PROGRESS.md — do not block.

## Context

The business plan requires photo provenance on contributed records
(`photo_evidence_url`, `product-images` storage bucket, moderation via
`pending_review`). User-taken photos are the evidence layer for crowdsourced
products. Privacy note: photos go into the pending-review moderation queue
before any public exposure — no additional client-side filtering required in
v1, but the capture UI hint (step 5) reduces accidental personal content.

## Locked decisions

- Upload target: **Supabase Storage**, bucket `product-images`, path
  `contributions/<productId>/<timestamp>.jpg`. Upload the **1600 px** copy
  from `pending-uploads/` (never the display copy, never the original camera
  file).
- Transport implements the `PhotoUploadTransport` interface from task 01 —
  the queue/drain mechanics do not change.
- After successful upload, the returned public/storage URL is attached to the
  product's **suggest payload** as `photo_evidence_url`:
  - If the product's `suggestProduct` POST has not fired yet → include the URL
    in the payload.
  - If it already fired → send a lightweight follow-up
    (`PATCH /api/v1/products/suggest/<suggestionId>` if the API supports it;
    if the API surface doesn't exist yet, define the client call + payload
    type now, stub the HTTP layer, and record the server-side TODO in
    BLOCKERS.md). Investigate what `suggestProduct` currently returns
    (an id?) before choosing.
- The URL is stored server-side only. Do NOT write the storage URL into the
  local product's `imageUrl` — `imageUrl` remains reserved for approved,
  server-canonical images arriving via lookup/search/sync. (Rationale: an
  unmoderated self-uploaded URL must not masquerade as canonical data.)
- Retry policy: max **5 attempts** per entry; after that, keep the entry with
  a `failed` marker, stop retrying automatically, delete the pending file
  after **30 days** (cleanup pass inside `drain`). All failures stay silent.
- Anonymity constraint (architecture rule): no user identity in the upload —
  no device IDs, no profile data in path or metadata. `productId` is a local
  UUID, acceptable.

## Steps

1. **Dependency:** `npx expo install @supabase/supabase-js` (verify Expo Go /
   SDK 54 compatibility — it's pure JS, expected fine). Client factory in
   `src/services/supabaseClient.ts` reading env vars; throw-free init (missing
   env → transport reports unavailable, queue stays put).
2. **`src/services/photoUploadTransport.supabase.ts`** — real transport:
   reads the pending file (expo-file-system new API), uploads to the bucket,
   returns `{ remoteUrl }`. Map storage errors to soft failures.
3. **Queue integration:** extend `PhotoUploadQueueEntry` with
   `remoteUrl?: string` and `failed?: boolean`; implement the 5-attempt cap
   and 30-day cleanup in `drain`. Keep the entry (with `remoteUrl`) until the
   suggest-payload linking (step 4) has also succeeded, then remove.
4. **Suggest linking:** implement the two linking paths from the locked
   decisions. Add `photo_evidence_url?: string` to `SuggestPayload`
   (server-bound type — this is allowed; it's a remote URL, not a local path).
5. **Capture UI hint:** in the photo-capture entry points (form attach from
   task 02 if present, otherwise just the service-level Alert), add a one-line
   hint: "Photograph only the product" (localize consistently with existing
   copy conventions). Minimal, non-blocking.
6. **Bucket setup doc:** write `docs/tasks/product-images/SUPABASE_SETUP.md`
   with the SQL/dashboard steps a human must run: create bucket
   `product-images`, storage policy allowing anon INSERT into
   `contributions/*` but no public LIST, plus whatever RLS the review flow
   needs. Do not attempt to run these against a live project.
7. **Tests:** transport (mock supabase client): success, storage error,
   missing env. Drain integration: attempt cap, 30-day cleanup, entry retained
   until link succeeds.

## Acceptance

- With env vars present: a queued photo uploads on foreground drain, the file
  leaves `pending-uploads/`, and the suggest payload carries
  `photo_evidence_url`.
- Without env vars: everything no-ops silently; nothing crashes; queue intact.
- Grep check: no `localImageUri`, no `file://` path, and no profile/device
  identifiers in any outbound payload or storage path.
- `npx tsc --noEmit` clean; tests green.
