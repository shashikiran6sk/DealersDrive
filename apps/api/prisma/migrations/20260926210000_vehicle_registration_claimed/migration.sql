-- One car in review or on sale once, across every dealership (F065).
--
-- A draft is a dealership's private note: two dealerships may both have typed
-- KA01AB1234, and letting one dealer's abandoned draft lock the plate out for
-- everybody else would be a squatting problem this index created. Submitting
-- is different. It asks Dealers-Drive to photograph the car and publish it, and
-- a second dealership asking the same of the same car is either a duplicate or
-- a car that is not theirs to sell.
--
-- `claimedAt` is set on the first submission and never cleared; `releasedAt`
-- is set when the listing reaches REJECTED, SOLD or REMOVED. A claimed,
-- unreleased vehicle is therefore exactly one that is PENDING_REVIEW,
-- CHANGES_REQUESTED or ACTIVE.

ALTER TABLE "vehicles" ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "vehicles_registrationNumber_claimed_key"
    ON "vehicles"("registrationNumber")
    WHERE "releasedAt" IS NULL AND "claimedAt" IS NOT NULL;
