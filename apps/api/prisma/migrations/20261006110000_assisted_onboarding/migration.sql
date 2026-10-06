-- Assisted onboarding: a Sales Representative onboards a dealership with the
-- dealer, through the same dealership row and the same review lifecycle.
--
-- Additive and nullable (or defaulted): every existing dealership reads
-- onboardingSource = SELF, which is what each of them was. No backfill.
--
-- `assistedByMemberId` is ON DELETE RESTRICT: Admin Members are disabled,
-- never deleted, and sales attribution must not silently vanish.

CREATE TYPE "DealerOnboardingSource" AS ENUM ('SELF', 'ASSISTED');

ALTER TABLE "dealers"
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "contactPhoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "contactEmailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingSource" "DealerOnboardingSource" NOT NULL DEFAULT 'SELF',
  ADD COLUMN "assistedByMemberId" UUID,
  ADD COLUMN "assistedConsentAt" TIMESTAMP(3);

CREATE INDEX "dealers_assistedByMemberId_status_idx" ON "dealers"("assistedByMemberId", "status");

ALTER TABLE "dealers" ADD CONSTRAINT "dealers_assistedByMemberId_fkey"
  FOREIGN KEY ("assistedByMemberId") REFERENCES "admin_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An assisted dealership always names who assisted it; a self-onboarded one never does.
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_assisted_attribution"
  CHECK (("onboardingSource" = 'ASSISTED') = ("assistedByMemberId" IS NOT NULL));
