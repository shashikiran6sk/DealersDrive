-- Admin Members: a first-class record of every internal team member.
--
-- Until now an operator was three facts on `users` (isPlatformAdmin,
-- adminRole) and `user_roles` (the ADMIN seat). This table makes the person,
-- their role and their lifecycle one row, and it becomes what the console's
-- authorization reads. The old columns are kept and still written, so an
-- application rollback answers the same way.
--
-- `SALES_REP` is added to the role enum. It is not used in this migration
-- (Postgres refuses a value added in the same transaction that uses it).

ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'SALES_REP';

CREATE TYPE "AdminMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');
CREATE TYPE "AdminMemberSource" AS ENUM ('BOOTSTRAP', 'INVITED');

CREATE TABLE "admin_members" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "AdminRole" NOT NULL,
    "status" "AdminMemberStatus" NOT NULL DEFAULT 'INVITED',
    "source" "AdminMemberSource" NOT NULL DEFAULT 'INVITED',
    "invitedBy" UUID,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "disabledBy" UUID,
    "disabledReason" TEXT,
    "roleChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_members_userId_key" ON "admin_members"("userId");
CREATE INDEX "admin_members_status_role_idx" ON "admin_members"("status", "role");

ALTER TABLE "admin_members" ADD CONSTRAINT "admin_members_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill every existing operator, preserving exactly who could get in.
--
--   ADMIN seat SUSPENDED                     → DISABLED
--   seat granted by a Super admin            → source INVITED
--   no granter (allow-listed / seeded)       → source BOOTSTRAP, admitted only
--                                              while still on ADMIN_ALLOWLIST,
--                                              as before
--   has signed in with Google                → ACTIVE, else INVITED (a grant
--                                              nobody has used yet; the first
--                                              sign-in activates it)
INSERT INTO "admin_members" (
  "id", "userId", "role", "status", "source", "invitedBy", "invitedAt",
  "activatedAt", "lastLoginAt", "disabledAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  u."id",
  u."adminRole",
  CASE
    WHEN r."status" = 'SUSPENDED' THEN 'DISABLED'::"AdminMemberStatus"
    WHEN EXISTS (SELECT 1 FROM "oauth_identities" o WHERE o."userId" = u."id")
      OR r."grantedBy" IS NULL THEN 'ACTIVE'::"AdminMemberStatus"
    ELSE 'INVITED'::"AdminMemberStatus"
  END,
  CASE WHEN r."grantedBy" IS NULL THEN 'BOOTSTRAP'::"AdminMemberSource"
       ELSE 'INVITED'::"AdminMemberSource" END,
  r."grantedBy",
  COALESCE(r."grantedAt", u."createdAt"),
  CASE WHEN EXISTS (SELECT 1 FROM "oauth_identities" o WHERE o."userId" = u."id")
       THEN u."lastLoginAt" END,
  u."lastLoginAt",
  r."suspendedAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
LEFT JOIN "user_roles" r ON r."userId" = u."id" AND r."role" = 'ADMIN'
WHERE u."isPlatformAdmin" = true AND u."adminRole" IS NOT NULL
ON CONFLICT ("userId") DO NOTHING;
