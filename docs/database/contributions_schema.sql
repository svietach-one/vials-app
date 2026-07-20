-- Vials contributions DB (vials-contributions) — schema v1
--
-- A SEPARATE Turso database from the product corpus. The app writes here and
-- never reads; the corpus replica reads and never writes. Keeping unapproved
-- submissions in their own database is what replaces Supabase RLS: unapproved
-- content is physically absent from the client's corpus replica rather than
-- hidden from it by a row-visibility policy.
--
-- Provision:
--   turso db create vials-contributions
--   turso db shell vials-contributions < docs/database/contributions_schema.sql
--
-- Client token — narrowest scope Turso offers (INSERT-only, one table):
--   turso db tokens create vials-contributions -p contributions:data_add --expiration 90d
--
-- That token cannot read rows back, update, delete, or alter schema. Put it in
-- EXPO_PUBLIC_TURSO_CONTRIBUTIONS_TOKEN. NEVER reuse the corpus read token
-- here, and never place both in the same config block.

CREATE TABLE IF NOT EXISTS contributions (
  id             TEXT PRIMARY KEY,              -- client-generated row id (NOT a user id)
  brand          TEXT,
  name           TEXT NOT NULL,
  product_type   TEXT NOT NULL,
  inci_raw       TEXT,
  photo_blob     BLOB,                          -- ~1200px JPEG q0.7, EXIF-stripped; NULL = text-only
  status         TEXT NOT NULL DEFAULT 'pending_review',
  created_at     TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions (status);
CREATE INDEX IF NOT EXISTS idx_contributions_created ON contributions (created_at);

-- ── Manual moderation (no dashboard in this phase) ──────────────────────────
--
-- Review the queue (photo_blob omitted so the output stays readable):
--   SELECT id, brand, name, product_type, created_at,
--          length(photo_blob) AS photo_bytes
--   FROM contributions WHERE status = 'pending_review'
--   ORDER BY created_at;
--
-- Export one photo to inspect it:
--   turso db shell vials-contributions \
--     "SELECT writefile('/tmp/review.jpg', photo_blob) FROM contributions WHERE id = '<id>';"
--
-- Approve → insert into the corpus DB (a DIFFERENT database; run against
-- vials-corpus, and mint a separate write token for that session — the app's
-- corpus token is read-only by design and must stay that way):
--   INSERT INTO products (uid, brand, name, type, inci_raw, source)
--   VALUES ('<uid>', '<brand>', '<name>', '<type>', '<inci_raw>', 'community');
--
-- Then mark it handled here:
--   UPDATE contributions SET status = 'approved' WHERE id = '<id>';
--   UPDATE contributions SET status = 'rejected' WHERE id = '<id>';
