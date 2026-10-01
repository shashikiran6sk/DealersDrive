-- R92 — dealer memberships carry fixed OWNER / MANAGER / STAFF roles.
--
-- Additive and safe on a live database. No dealership changes owner: every
-- dealership already has its OWNER row in `dealer_members` — onboarding has
-- written it in the same transaction as the dealership since F037 — so there is
-- no membership to backfill, only columns and indexes to add.

-- `SALES` becomes `STAFF`. A rename in place rather than Prisma's default
-- create-new-type-and-cast, which rewrites the table under an exclusive lock;
-- RENAME VALUE only touches the catalogue, and any existing row keeps its value.
ALTER TYPE "DealerRole" RENAME VALUE 'SALES' TO 'STAFF';

ALTER TABLE "dealer_members"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- An existing member joined when their dealership was created; "the deploy
-- happened" is not a date anybody would want on the Team page. Idempotent: a
-- second run writes the same values.
UPDATE "dealer_members" AS m
SET "createdAt" = d."createdAt", "updatedAt" = d."createdAt"
FROM "dealers" AS d
WHERE d."id" = m."dealerId";

-- Membership is resolved on every dealer request by (userId, status).
DROP INDEX "dealer_members_userId_idx";
CREATE INDEX "dealer_members_userId_status_idx" ON "dealer_members"("userId", "status");
CREATE INDEX "dealer_members_dealerId_status_idx" ON "dealer_members"("dealerId", "status");

-- Who moved an enquiry, now that more than one person can.
ALTER TABLE "enquiries"
  ADD COLUMN "contactedById" UUID,
  ADD COLUMN "closedById" UUID;

ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_contactedById_fkey"
  FOREIGN KEY ("contactedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
