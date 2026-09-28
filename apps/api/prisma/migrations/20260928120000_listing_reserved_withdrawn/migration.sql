-- The customer-facing lifecycle (R69): ACTIVE, RESERVED, SOLD, WITHDRAWN.
--
-- RESERVED is new: still on the marketplace, but not available. It is added
-- after ACTIVE so that ORDER BY status puts an available car first.
--
-- WITHDRAWN is REMOVED renamed. Nothing but the state machine wrote REMOVED and
-- no route reached it, so the rename keeps every row and changes no meaning a
-- reader relied on. A listing withdrawn from now on keeps holding its
-- registration, so it can be relisted; a row removed before this migration may
-- already have released it, and the relist path reclaims it (or refuses with a
-- 409 if the plate has been claimed since).

ALTER TYPE "ListingStatus" RENAME VALUE 'REMOVED' TO 'WITHDRAWN';
ALTER TYPE "ListingStatus" ADD VALUE 'RESERVED' AFTER 'ACTIVE';

CREATE TYPE "WithdrawalReason" AS ENUM (
    'NO_LONGER_FOR_SALE',
    'VEHICLE_ISSUE',
    'DOCUMENT_ISSUE',
    'TEMPORARILY_PAUSED',
    'OTHER'
);

ALTER TABLE "listings" RENAME COLUMN "removedAt" TO "withdrawnAt";
ALTER TABLE "listings"
    ADD COLUMN "reservedAt" TIMESTAMP(3),
    ADD COLUMN "withdrawalReason" "WithdrawalReason",
    ADD COLUMN "withdrawalNote" TEXT;
