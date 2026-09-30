-- Reactivation requests: a dealer asks, an admin decides.
--
-- A RESERVED or WITHDRAWN listing goes back on sale only on an admin's
-- approval. The dealer files a request; approval moves the listing to ACTIVE in
-- the same transaction, rejection leaves it where it is. A request the listing
-- outran (the reserved car was sold while it waited) is CANCELLED by the move.

CREATE TYPE "ReactivationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "listing_reactivation_requests" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "fromStatus" "ListingStatus" NOT NULL,
    "status" "ReactivationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requestedBy" UUID,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,

    CONSTRAINT "listing_reactivation_requests_pkey" PRIMARY KEY ("id"),
    -- Only a reserved or a withdrawn car can be asked back on sale.
    CONSTRAINT "listing_reactivation_requests_from_status_check"
        CHECK ("fromStatus" IN ('RESERVED', 'WITHDRAWN')),
    -- A decided request records when; a pending one has not been decided.
    CONSTRAINT "listing_reactivation_requests_reviewed_check"
        CHECK (("status" = 'PENDING') = ("reviewedAt" IS NULL))
);

-- The review queue, oldest first.
CREATE INDEX "listing_reactivation_requests_status_requestedAt_idx"
    ON "listing_reactivation_requests"("status", "requestedAt");

-- A listing's own requests, newest first.
CREATE INDEX "listing_reactivation_requests_listingId_requestedAt_idx"
    ON "listing_reactivation_requests"("listingId", "requestedAt");

CREATE INDEX "listing_reactivation_requests_dealerId_idx"
    ON "listing_reactivation_requests"("dealerId");

ALTER TABLE "listing_reactivation_requests"
    ADD CONSTRAINT "listing_reactivation_requests_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "listing_reactivation_requests"
    ADD CONSTRAINT "listing_reactivation_requests_dealerId_fkey"
    FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── At most one request waiting per listing ─────────────────────────────────
--
-- A partial unique index, which Prisma's schema language cannot express. The
-- service checks first and answers a duplicate with a 409; this index is the
-- guarantee under a race (a double click, two tabs). Decided rows accumulate:
-- they are the listing's history.
CREATE UNIQUE INDEX "listing_reactivation_requests_one_pending_per_listing"
    ON "listing_reactivation_requests"("listingId")
    WHERE "status" = 'PENDING';
