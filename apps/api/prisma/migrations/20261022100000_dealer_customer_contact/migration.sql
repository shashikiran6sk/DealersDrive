ALTER TABLE "dealers"
  ADD COLUMN "landlineConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "landlineApprovedAt" TIMESTAMP(3);
ALTER TABLE "dealer_profile_changes"
  ADD COLUMN "landline" TEXT,
  ADD COLUMN "landlineChanged" BOOLEAN NOT NULL DEFAULT false;
UPDATE "dealers" SET "medianResponseMins" = NULL;
CREATE INDEX "enquiries_dealer_response_idx" ON "enquiries" ("dealerId", "createdAt") WHERE "contactedAt" IS NOT NULL AND "status" <> 'SPAM';
