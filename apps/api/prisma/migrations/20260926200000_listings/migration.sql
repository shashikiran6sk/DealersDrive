-- The listing lifecycle (F064, as revised by R47).
--
-- One listing per vehicle, created with it as DRAFT. The status is written by
-- `transition()` in `modules/listings/listing.state.ts` and by nothing else;
-- every transition puts the state it expects in its WHERE clause, so two racing
-- decisions on one listing cannot both succeed.
--
-- R47 states: there is no APPROVED (it is spelled ACTIVE) and no EXPIRED until
-- something expires a listing.

CREATE TYPE "ListingStatus" AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'CHANGES_REQUESTED',
    'ACTIVE',
    'REJECTED',
    'SOLD',
    'REMOVED'
);

CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "lastSubmittedAt" TIMESTAMP(3),
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "decidedBy" UUID,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "listings_submissionCount_check" CHECK ("submissionCount" >= 0)
);

CREATE UNIQUE INDEX "listings_vehicleId_key" ON "listings"("vehicleId");
CREATE INDEX "listings_dealerId_status_updatedAt_idx" ON "listings"("dealerId", "status", "updatedAt");
CREATE INDEX "listings_status_lastSubmittedAt_idx" ON "listings"("status", "lastSubmittedAt");
CREATE INDEX "listings_status_publishedAt_idx" ON "listings"("status", "publishedAt");

ALTER TABLE "listings"
    ADD CONSTRAINT "listings_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "listings"
    ADD CONSTRAINT "listings_dealerId_fkey"
    FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every vehicle that already exists is a draft: nothing could submit one before
-- this migration. Written here rather than lazily, so no read has to cope with a
-- vehicle that has no listing.
INSERT INTO "listings" ("id", "vehicleId", "dealerId", "status", "updatedAt")
SELECT gen_random_uuid(), "id", "dealerId", 'DRAFT', CURRENT_TIMESTAMP
  FROM "vehicles";
