-- Assisted dealership email verification and claim (R113).
--
-- One row per verification link sent to an assisted dealership's contactEmail.
-- Only the SHA-256 of the token is stored, and only once the email job has
-- minted it, so a database read never yields a working link.
--
-- New table only: no existing row changes, no backfill.

CREATE TABLE "dealer_email_verifications" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT,
    "requestedByMemberId" UUID,
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimedByUserId" UUID,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_email_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dealer_email_verifications_tokenHash_key" ON "dealer_email_verifications"("tokenHash");

CREATE INDEX "dealer_email_verifications_dealerId_createdAt_idx" ON "dealer_email_verifications"("dealerId", "createdAt");

ALTER TABLE "dealer_email_verifications" ADD CONSTRAINT "dealer_email_verifications_dealerId_fkey"
  FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dealer_email_verifications" ADD CONSTRAINT "dealer_email_verifications_requestedByMemberId_fkey"
  FOREIGN KEY ("requestedByMemberId") REFERENCES "admin_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
