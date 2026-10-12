-- Dealer portfolio photographs with moderation, and private internal yard
-- visits (#299). Additive. The single yard photograph onboarding used to
-- collect is carried over as a legacy portfolio photograph: APPROVED for a
-- dealership already reviewed (ACTIVE or SUSPENDED), so its public page keeps
-- exactly the image it shows today; PENDING for one still in onboarding, so a
-- reviewer decides it before it can ever be served; and not carried at all for
-- a CLOSED or REJECTED one. Nothing is deleted and `coverMediaId` stays as it
-- was. New enum values are added outside the transaction and are not used by
-- this migration.
ALTER TYPE "MediaOwner" ADD VALUE IF NOT EXISTS 'DEALER_PORTFOLIO';
ALTER TYPE "MediaOwner" ADD VALUE IF NOT EXISTS 'DEALER_YARD_VISIT';

BEGIN;
CREATE TYPE "PortfolioPhotoStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REMOVED');
CREATE TYPE "YardVisitOutcome" AS ENUM ('YARD_CONFIRMED', 'NO_PHYSICAL_YARD', 'NOT_ACCESSIBLE');

CREATE TABLE "dealer_portfolio_photos" (
  "id" UUID NOT NULL,
  "dealerId" UUID NOT NULL,
  "mediaId" UUID NOT NULL,
  "status" "PortfolioPhotoStatus" NOT NULL DEFAULT 'PENDING',
  "replacesId" UUID,
  "position" INTEGER NOT NULL DEFAULT 0,
  "caption" TEXT,
  "rejectionReason" TEXT,
  "submittedById" UUID,
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMP(3),
  "legacyCover" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dealer_portfolio_photos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dealer_portfolio_photos_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dealer_portfolio_photos_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "dealer_portfolio_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "dealer_portfolio_photos_rejection_check" CHECK (("status" = 'REJECTED') = ("rejectionReason" IS NOT NULL)),
  CONSTRAINT "dealer_portfolio_photos_review_check" CHECK (
    "status" NOT IN ('APPROVED', 'REJECTED') OR "legacyCover" OR ("reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL)
  ),
  CONSTRAINT "dealer_portfolio_photos_replaces_check" CHECK ("replacesId" IS NULL OR "replacesId" <> "id"),
  CONSTRAINT "dealer_portfolio_photos_position_check" CHECK ("position" >= 0)
);
CREATE UNIQUE INDEX "dealer_portfolio_photos_mediaId_key" ON "dealer_portfolio_photos"("mediaId");
CREATE INDEX "dealer_portfolio_photos_dealerId_status_position_idx" ON "dealer_portfolio_photos"("dealerId", "status", "position");
CREATE INDEX "dealer_portfolio_photos_status_createdAt_idx" ON "dealer_portfolio_photos"("status", "createdAt");
-- One pending replacement per approved photograph at a time.
CREATE UNIQUE INDEX "dealer_portfolio_photos_one_pending_replacement" ON "dealer_portfolio_photos"("replacesId")
  WHERE "status" = 'PENDING' AND "replacesId" IS NOT NULL;

INSERT INTO "dealer_portfolio_photos" ("id", "dealerId", "mediaId", "status", "position", "legacyCover", "updatedAt")
SELECT gen_random_uuid(), d."id", m."id",
  CASE WHEN d."status" IN ('ACTIVE', 'SUSPENDED') THEN 'APPROVED' ELSE 'PENDING' END::"PortfolioPhotoStatus",
  0, true, CURRENT_TIMESTAMP
FROM "dealers" d JOIN "media" m ON m."id" = d."coverMediaId"
WHERE m."status" = 'READY' AND m."ownerType" = 'DEALER_COVER'
  AND d."status" IN ('ACTIVE', 'SUSPENDED', 'DRAFT', 'PENDING_APPROVAL');

CREATE TABLE "dealer_yard_visits" (
  "id" UUID NOT NULL,
  "dealerId" UUID NOT NULL,
  "visitedOn" DATE NOT NULL,
  "outcome" "YardVisitOutcome" NOT NULL,
  "notes" TEXT,
  "recordedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dealer_yard_visits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dealer_yard_visits_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "dealer_yard_visits_dealerId_visitedOn_idx" ON "dealer_yard_visits"("dealerId", "visitedOn");

CREATE TABLE "dealer_yard_visit_photos" (
  "id" UUID NOT NULL,
  "visitId" UUID NOT NULL,
  "mediaId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dealer_yard_visit_photos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dealer_yard_visit_photos_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "dealer_yard_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "dealer_yard_visit_photos_mediaId_key" ON "dealer_yard_visit_photos"("mediaId");
COMMIT;
