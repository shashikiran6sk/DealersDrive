BEGIN;
ALTER TABLE "media" ADD COLUMN "derivativesRetryAt" TIMESTAMP(3);
CREATE INDEX "media_derivatives_retry_idx" ON "media" ("derivativesRetryAt", "createdAt")
  WHERE "ownerType"='VEHICLE' AND "status"='READY';
COMMIT;
