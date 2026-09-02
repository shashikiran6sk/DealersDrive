-- Plate-first vehicle intake: the RC spec cache, and the columns it fills.
--
-- Hand-written rather than generated. `prisma migrate diff` against this schema
-- also emits `DROP TABLE listing_search` and two index renames — `listing_search`
-- is the raw-SQL read model the entire public marketplace queries, and it is
-- deliberately absent from schema.prisma (see the 20260816183500 migration).
-- Anything generated here must be read before it is run.
--
-- Everything below is additive. The one statement that can fail is the partial
-- unique index at the bottom, and it fails loudly on purpose.

-- UNKNOWN is not CLEAR. Collapsing them would turn a provider outage into a
-- clean bill of health on a stolen car.
CREATE TYPE "BlacklistStatus" AS ENUM ('CLEAR', 'BLACKLISTED', 'NOC_ISSUED', 'UNKNOWN');

-- `normsType` (BS4/BS6) is materially price-relevant on an Indian used car and
-- comes only from the RC — there is no way for a dealer to type it.
-- `rcVerifiedAt` is a timestamp rather than a boolean because "verified when?"
-- is the question a dealer disputing a record actually asks.
ALTER TABLE "vehicles"
  ADD COLUMN "normsType"    TEXT,
  ADD COLUMN "rcVerifiedAt" TIMESTAMP(3);

-- The 30-day cache of immutable RC facts.
--
-- No `dealerId`, deliberately: an RC is a fact about a car, not a dealership,
-- and two dealers appraising the same trade-in should not both be charged for
-- it. This table is cross-tenant by design and tenant-isolation.test.ts
-- documents it as an exception rather than a gap.
--
-- The plate is stored only as an HMAC. Real listings already hold the plate in
-- `vehicles.regNumberMasked`, so this is not secrecy from ourselves — it is
-- about not accumulating a standalone, queryable register of every plate anyone
-- ever asked about, including the ones that never became a listing.
CREATE TABLE "rc_lookups" (
    "id"        UUID         NOT NULL,
    "regHash"   TEXT         NOT NULL,
    "provider"  TEXT         NOT NULL,
    "specs"     JSONB        NOT NULL,
    "resolved"  JSONB        NOT NULL,
    -- The records from the same provider call. Trusted only while `fetchedAt`
    -- is inside report.freshnessHours — `expiresAt` governs the specs alone.
    "records"   JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "found"     BOOLEAN      NOT NULL DEFAULT true,

    CONSTRAINT "rc_lookups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rc_lookups_regHash_key" ON "rc_lookups"("regHash");
CREATE INDEX "rc_lookups_expiresAt_idx" ON "rc_lookups"("expiresAt");

-- One live car per plate per dealer, guaranteed by the database rather than by
-- application code that might be skipped (§6.1, same reasoning as the partial
-- unique index on approved listings).
--
-- THIS MIGRATION FAILS if any dealer already holds two non-deleted vehicles
-- with the same registration. That is the correct outcome — it means two live
-- listings disagree about which car a plate belongs to, which is a human
-- decision, not something a migration should silently resolve by picking one.
--
-- The check below exists so the failure explains itself. Left to Postgres, the
-- CREATE UNIQUE INDEX reports a single arbitrary offending key and stops; on a
-- database with a dozen collisions that is a dozen deploys to enumerate them.
-- This raises once, listing every pair, so the whole cleanup can be planned
-- from one log line.
--
-- NULL plates are excluded throughout: every vehicle added before this feature
-- has one, and they are not duplicates of each other.
DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(format('  dealer %s plate %s — vehicles %s',
                           "dealerId", "regNumberMasked", ids), E'\n')
    INTO offenders
    FROM (
      SELECT "dealerId",
             "regNumberMasked",
             string_agg(id::text, ', ' ORDER BY "createdAt") AS ids
        FROM vehicles
       WHERE "deletedAt" IS NULL
         AND "regNumberMasked" IS NOT NULL
       GROUP BY "dealerId", "regNumberMasked"
      HAVING count(*) > 1
    ) dupes;

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot add the one-live-car-per-plate constraint: % dealer/plate pair(s) already duplicated.%',
      (SELECT count(*) FROM (
         SELECT 1 FROM vehicles
          WHERE "deletedAt" IS NULL AND "regNumberMasked" IS NOT NULL
          GROUP BY "dealerId", "regNumberMasked" HAVING count(*) > 1) x),
      E'\n' || offenders
      USING HINT = 'Decide per pair which vehicle keeps the plate, then clear or correct regNumberMasked on the others (or soft-delete a genuine duplicate). Re-run the migration afterwards.';
  END IF;
END $$;

CREATE UNIQUE INDEX "vehicles_dealer_reg_active_key"
  ON "vehicles" ("dealerId", "regNumberMasked")
  WHERE "deletedAt" IS NULL AND "regNumberMasked" IS NOT NULL;
