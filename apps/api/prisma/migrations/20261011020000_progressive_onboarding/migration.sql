BEGIN;
ALTER TABLE "dealers" ADD COLUMN "progressiveRegisteredAt" TIMESTAMP(3),
 ADD COLUMN "progressiveConsentVersion" TEXT,
 ADD COLUMN "progressivePlan" JSONB,
 ADD COLUMN "progressiveVersion" INTEGER NOT NULL DEFAULT 0,
 ADD CONSTRAINT "dealers_progressive_consent_pair" CHECK (("progressiveRegisteredAt" IS NULL)=("progressiveConsentVersion" IS NULL)),
 ADD CONSTRAINT "dealers_progressive_version" CHECK ("progressiveVersion">=0);
COMMIT;
