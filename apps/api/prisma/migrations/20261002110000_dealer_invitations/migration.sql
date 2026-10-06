-- R94 — a dealership's owner invites members by mobile number.
--
-- Additive: three nullable columns on dealer_members and one new table. No
-- existing row changes.

ALTER TABLE "dealer_members"
  ADD COLUMN "invitedBy" UUID,
  ADD COLUMN "removedAt" TIMESTAMP(3),
  ADD COLUMN "removedBy" UUID;

CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');

CREATE TABLE "dealer_invitations" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "DealerRole" NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedBy" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedBy" UUID,
    "respondedAt" TIMESTAMP(3),
    "revokedBy" UUID,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_invitations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dealer_invitations_phone_status_idx" ON "dealer_invitations"("phone", "status");
CREATE INDEX "dealer_invitations_dealerId_status_createdAt_idx" ON "dealer_invitations"("dealerId", "status", "createdAt");

-- One invitation waiting per number per dealership. Two owners' devices
-- inviting the same number at the same moment produce one row, not two; the
-- service amends the row it finds rather than relying on this, and this is
-- what makes that true under a race.
CREATE UNIQUE INDEX "dealer_invitations_one_pending"
  ON "dealer_invitations"("dealerId", "phone") WHERE "status" = 'PENDING';

-- An invitation holds the canonical number, the same CHECK users.phone carries.
ALTER TABLE "dealer_invitations" ADD CONSTRAINT "dealer_invitations_phone_canonical"
  CHECK ("phone" ~ '^\+91[6-9][0-9]{9}$');

ALTER TABLE "dealer_invitations" ADD CONSTRAINT "dealer_invitations_dealerId_fkey"
  FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
