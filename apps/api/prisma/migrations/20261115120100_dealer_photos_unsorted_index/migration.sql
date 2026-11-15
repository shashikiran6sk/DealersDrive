-- One photograph per named shot; unsorted photographs, like extras, may stack.
-- A separate migration because Postgres cannot use an enum value in the
-- transaction that added it.
DROP INDEX IF EXISTS "vehicle_submission_photos_one_per_slot";
CREATE UNIQUE INDEX "vehicle_submission_photos_one_per_slot"
  ON "vehicle_submission_photos"("vehicleId", "slot") WHERE "slot" NOT IN ('UNSORTED', 'EXTRA');
