-- Deliberately outside a transaction and alone in its migration: enquiry writes stay available,
-- and a failed build leaves nothing else half-applied. IF NOT EXISTS makes a retry after
-- dropping an INVALID index safe.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "enquiries_sharingGrantId_idx" ON "enquiries"("sharingGrantId");
