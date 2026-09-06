-- The district, and the end of password authentication.
--
-- Two unrelated changes in one migration because they land in one release, and
-- a release that leaves the schema half-applied is worse than a migration that
-- covers two subjects.
--
--  1. `dealers.district`. Onboarding asks for it, and the admin console filters
--     on it alongside city and state. Nullable, because every dealership that
--     already exists was created before the question was asked — there is no
--     defensible value to backfill, and a wrong district is worse than an
--     absent one for a filter whose whole job is to be believed.
--
--  2. `users.passwordHash` goes. Admins sign in with Google against an
--     allow-list (`ADMIN_ALLOWLIST`), so nothing in the application reads or
--     writes this column any more. Dropping it rather than leaving it unused is
--     the point: a password column nobody verifies is a credential store nobody
--     rotates, and the safest hash is the one that is not there.

-- ─── 1. the district ────────────────────────────────────────────────────────

ALTER TABLE "dealers" ADD COLUMN "district" TEXT;

-- The console narrows from the outside in — a state, then a district, then a
-- town — so the index is ordered the way the filters are applied.
CREATE INDEX "dealers_state_district_city_idx" ON "dealers"("state", "district", "city");

-- ─── 2. no more passwords ───────────────────────────────────────────────────

ALTER TABLE "users" DROP COLUMN "passwordHash";
