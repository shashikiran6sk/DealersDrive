BEGIN;

CREATE TYPE "PhotoCredit" AS ENUM ('DEALERS_DRIVE', 'DEALER');

ALTER TABLE "vehicle_media" ADD COLUMN "credit" "PhotoCredit";

COMMIT;
