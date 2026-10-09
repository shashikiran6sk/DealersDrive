BEGIN;
ALTER TABLE "dealer_profile_changes" ADD COLUMN "taglineChanged" boolean NOT NULL DEFAULT false;
-- Preserve every historical proposal and every live tagline.
UPDATE "dealer_profile_changes" SET "taglineChanged" = true WHERE "tagline" IS NOT NULL;
COMMIT;
