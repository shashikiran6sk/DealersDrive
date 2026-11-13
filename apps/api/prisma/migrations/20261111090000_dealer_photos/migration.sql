-- Dealer photographs (R45, partially revised).
--
-- Additive only: two new enums, one new table, one nullable listing column and
-- a new media owner type. Live listings are untouched; their photoPlan is NULL.

-- A new enum value cannot be used in the transaction that adds it, and it is
-- not used here.
ALTER TYPE "MediaOwner" ADD VALUE IF NOT EXISTS 'VEHICLE_SUBMISSION';

CREATE TYPE "PhotoPlan" AS ENUM ('DEALER', 'DEALERS_DRIVE');

CREATE TYPE "VehiclePhotoSlot" AS ENUM (
  'FRONT_THREE_QUARTER', 'FRONT', 'LEFT_SIDE', 'REAR_THREE_QUARTER', 'REAR',
  'RIGHT_SIDE', 'DASHBOARD', 'FRONT_SEATS', 'REAR_SEATS', 'ODOMETER', 'EXTRA'
);

ALTER TABLE "listings" ADD COLUMN "photoPlan" "PhotoPlan";

CREATE TABLE "vehicle_submission_photos" (
  "id" UUID NOT NULL,
  "vehicleId" UUID NOT NULL,
  "dealerId" UUID NOT NULL,
  "mediaId" UUID NOT NULL,
  "slot" "VehiclePhotoSlot" NOT NULL,
  "uploadedBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicle_submission_photos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vehicle_submission_photos_mediaId_key" ON "vehicle_submission_photos"("mediaId");
CREATE INDEX "vehicle_submission_photos_vehicleId_slot_idx" ON "vehicle_submission_photos"("vehicleId", "slot");
CREATE INDEX "vehicle_submission_photos_dealerId_idx" ON "vehicle_submission_photos"("dealerId");
CREATE UNIQUE INDEX "vehicle_submission_photos_one_per_slot"
  ON "vehicle_submission_photos"("vehicleId", "slot") WHERE "slot" <> 'EXTRA';
ALTER TABLE "vehicle_submission_photos"
  ADD CONSTRAINT "vehicle_submission_photos_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "vehicle_submission_photos_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "vehicle_submission_photos_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
