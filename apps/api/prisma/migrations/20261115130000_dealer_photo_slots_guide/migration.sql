-- The photo slots of the confirmed Dealers-Drive photo guide, whatever slot list
-- a database was created with while this feature was in review. The type is
-- rebuilt rather than altered so one migration fits every earlier state:
--   FRONT_THREE_QUARTER -> FRONT_THREE_QUARTER_RIGHT (photo 1, the driver side)
--   REAR_THREE_QUARTER  -> UNSORTED (not in the guide; the review team places it)
-- Every other value keeps its name, so no photograph is lost.

DROP INDEX IF EXISTS "vehicle_submission_photos_one_per_slot";

ALTER TYPE "VehiclePhotoSlot" RENAME TO "VehiclePhotoSlot_previous";

CREATE TYPE "VehiclePhotoSlot" AS ENUM (
  'FRONT_THREE_QUARTER_RIGHT', 'FRONT', 'FRONT_THREE_QUARTER_LEFT', 'LEFT_SIDE', 'REAR',
  'RIGHT_SIDE', 'FRONT_SEATS', 'REAR_SEATS', 'DASHBOARD', 'ODOMETER', 'UNSORTED', 'EXTRA'
);

ALTER TABLE "vehicle_submission_photos"
  ALTER COLUMN "slot" TYPE "VehiclePhotoSlot"
  USING (
    CASE "slot"::text
      WHEN 'FRONT_THREE_QUARTER' THEN 'FRONT_THREE_QUARTER_RIGHT'
      WHEN 'REAR_THREE_QUARTER' THEN 'UNSORTED'
      ELSE "slot"::text
    END
  )::"VehiclePhotoSlot";

DROP TYPE "VehiclePhotoSlot_previous";

CREATE UNIQUE INDEX "vehicle_submission_photos_one_per_slot"
  ON "vehicle_submission_photos"("vehicleId", "slot") WHERE "slot" NOT IN ('UNSORTED', 'EXTRA');
