BEGIN;
CREATE TYPE "DealerVerificationStatus" AS ENUM ('NOT_VERIFIED','PENDING','IN_REVIEW','VERIFIED','REJECTED','REVOKED');
ALTER TABLE "dealers"
  ADD COLUMN "verificationStatus" "DealerVerificationStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
  ADD COLUMN "verificationVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "verificationVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "verificationReviewerId" UUID,
  ADD CONSTRAINT "dealers_verification_version_check" CHECK ("verificationVersion" >= 0),
  ADD CONSTRAINT "dealers_verification_proof_check" CHECK (
    "verificationStatus" <> 'VERIFIED' OR
    ("verificationVerifiedAt" IS NOT NULL AND "verificationReviewerId" IS NOT NULL));
CREATE INDEX "dealers_verificationStatus_idx" ON "dealers" ("verificationStatus");
COMMIT;
