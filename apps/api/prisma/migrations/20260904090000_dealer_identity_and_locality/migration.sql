-- Dealer identity, and where a dealership is.
--
-- Two changes that have to land together, because the first one's constraint
-- is written in terms of the second one's column.
--
--  1. `cities` goes. It held five towns in one state, so it decided which
--     dealerships were allowed to exist rather than describing the ones that
--     do — a dealer in Salem could not finish onboarding, and one in Bengaluru
--     could not be described at all. `dealers.city` and `dealers.state` are
--     text, normalised on write. Existing rows keep their city by name.
--
--  2. A registered name is unique *within a city*, not globally. "Sri Balaji
--     Motors" is a name three unrelated families use in three different towns;
--     a global unique lets the first applicant lock the other two out. Inside
--     one city the same name is a duplicate application or an impersonation.
--     One GSTIN still belongs to one business anywhere.
--
-- Both uniques are enforced here as well as in the service, so that two
-- simultaneous applications racing cannot slip past a read-then-write check.
-- Postgres permits many NULLs in a unique index, which is what makes both safe
-- on nullable columns: dealerships without a GSTIN do not collide with each
-- other, and neither do rows with no city.

-- ─── 1. locality as text ────────────────────────────────────────────────────

ALTER TABLE "dealers" ADD COLUMN "city" TEXT;
ALTER TABLE "dealers" ADD COLUMN "state" TEXT;

UPDATE "dealers" AS d
SET "city" = c."name",
    "state" = c."state"
FROM "cities" AS c
WHERE d."cityId" = c."id";

DROP INDEX "dealers_status_cityId_idx";
ALTER TABLE "dealers" DROP CONSTRAINT "dealers_cityId_fkey";
ALTER TABLE "dealers" DROP COLUMN "cityId";

DROP TABLE "cities";

CREATE INDEX "dealers_status_city_idx" ON "dealers"("status", "city");

-- ─── 2. one name per city, one GSTIN anywhere ───────────────────────────────

CREATE UNIQUE INDEX "dealers_legalName_city_key" ON "dealers"("legalName", "city");
CREATE UNIQUE INDEX "dealers_gstin_key" ON "dealers"("gstin");
