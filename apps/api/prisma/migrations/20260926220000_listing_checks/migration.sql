-- The moderator's verification checklist (F070).
--
-- One row per thing verified; unchecking deletes the row, so there is no
-- "false" to misread. The rows are cleared when a dealer resubmits (a check made
-- against the old data says nothing about the new), and approval requires every
-- key to have one.

CREATE TYPE "ListingCheckKey" AS ENUM (
    'REGISTRATION',
    'MAKE_MODEL',
    'VARIANT',
    'YEAR',
    'ODOMETER',
    'OWNERSHIP',
    'PRICING'
);

CREATE TABLE "listing_checks" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "key" "ListingCheckKey" NOT NULL,
    "checkedBy" UUID NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_checks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "listing_checks_listingId_key_key" ON "listing_checks"("listingId", "key");

ALTER TABLE "listing_checks"
    ADD CONSTRAINT "listing_checks_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
