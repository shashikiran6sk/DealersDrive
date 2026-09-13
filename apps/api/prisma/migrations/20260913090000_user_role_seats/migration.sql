-- Per-role seats, so a suspension closes one door rather than all of them (R41).
--
-- The bug this fixes is one line of a previous migration's worth of behaviour,
-- not of schema: suspending a dealership wrote `users.status = 'SUSPENDED'` onto
-- every member and revoked every session they held. `users.status` is the whole
-- account, so a member who was also a platform admin lost the admin console too
-- — for a decision that was about a dealership.
--
-- `user_roles` splits the two. `users.status` stays what it always was, an
-- account-level switch for the whole person; a row here closes exactly one seat.
--
-- The backfill below is the part that needs reading twice. Three statements:
--
--   1. A DEALER seat for everybody who holds a dealership membership, carrying
--      over whatever `users.status` currently says — so a dealership suspended
--      yesterday is still suspended after this migration runs.
--   2. An ADMIN seat for everybody who is a platform admin, always ACTIVE. An
--      admin was never suspended *as an admin* before this table existed, so
--      ACTIVE is not a guess: there was no state to carry over.
--   3. The release. `setDealerStatus` was the only writer of
--      `users.status = 'SUSPENDED'` in the entire codebase, so every suspended
--      account that holds a membership was suspended by a dealership decision —
--      which statement 1 has just recorded in the right place. Leaving the
--      account-level flag set as well would keep the admin console shut for
--      exactly the person this change exists for.
--
-- An account suspended for a reason that was *not* a dealership decision would
-- be wrongly released by statement 3. None exists: no other code path writes it.

CREATE TYPE "PlatformRole" AS ENUM ('DEALER', 'ADMIN');
CREATE TYPE "UserRoleStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "status" "UserRoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- One seat of a kind per person. Every sign-in upserts against this index.
CREATE UNIQUE INDEX "user_roles_userId_role_key" ON "user_roles"("userId", "role");

-- "Who holds an operations seat" — the only read not keyed by a user.
CREATE INDEX "user_roles_role_status_idx" ON "user_roles"("role", "status");

ALTER TABLE "user_roles"
  ADD CONSTRAINT "user_roles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 1. The dealer seats, carrying the current suspension across.
INSERT INTO "user_roles" ("id", "userId", "role", "status", "reason", "suspendedAt")
SELECT
  gen_random_uuid(),
  u."id",
  'DEALER',
  CASE WHEN u."status" = 'SUSPENDED' THEN 'SUSPENDED'::"UserRoleStatus"
       ELSE 'ACTIVE'::"UserRoleStatus" END,
  CASE WHEN u."status" = 'SUSPENDED' THEN 'Suspended before per-role seats existed.' END,
  CASE WHEN u."status" = 'SUSPENDED' THEN CURRENT_TIMESTAMP END
FROM "users" u
WHERE EXISTS (SELECT 1 FROM "dealer_members" m WHERE m."userId" = u."id");

-- 2. The operations seats.
INSERT INTO "user_roles" ("id", "userId", "role", "status")
SELECT gen_random_uuid(), u."id", 'ADMIN', 'ACTIVE'
FROM "users" u
WHERE u."isPlatformAdmin" = TRUE;

-- 3. Release the account-level flag a dealership decision set.
UPDATE "users" u
   SET "status" = 'ACTIVE'
 WHERE u."status" = 'SUSPENDED'
   AND EXISTS (SELECT 1 FROM "dealer_members" m WHERE m."userId" = u."id");
