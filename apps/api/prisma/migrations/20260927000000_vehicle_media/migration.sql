-- Vehicle images, uploaded by an admin (R45; F035 as reinterpreted).
--
-- One row per image attached to a vehicle, in gallery order. The file itself
-- is a `media` row (ownerType VEHICLE, uploadedByAdmin); this table says which
-- vehicle it belongs to, where it sits and whether it is the primary.
--
-- `source` has one value today. A later StudioCar import adds a value and its
-- own nullable reference columns; nothing here calls StudioCar.

CREATE TYPE "VehicleMediaSource" AS ENUM ('ADMIN_UPLOAD');

CREATE TABLE "vehicle_media" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "source" "VehicleMediaSource" NOT NULL DEFAULT 'ADMIN_UPLOAD',
    "addedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_media_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_media_position_check" CHECK ("position" >= 0)
);

CREATE UNIQUE INDEX "vehicle_media_mediaId_key" ON "vehicle_media"("mediaId");
CREATE INDEX "vehicle_media_vehicleId_position_idx" ON "vehicle_media"("vehicleId", "position");

-- Order is deterministic: one image per position per vehicle. Deferred to
-- commit so a reorder can shift rows through each other in one transaction.
ALTER TABLE "vehicle_media"
    ADD CONSTRAINT "vehicle_media_vehicleId_position_key"
    UNIQUE ("vehicleId", "position") DEFERRABLE INITIALLY DEFERRED;

-- At most one primary image per vehicle — a database fact, not a UI convention.
CREATE UNIQUE INDEX "vehicle_media_one_primary"
    ON "vehicle_media"("vehicleId") WHERE "isPrimary";

ALTER TABLE "vehicle_media"
    ADD CONSTRAINT "vehicle_media_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_media"
    ADD CONSTRAINT "vehicle_media_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
