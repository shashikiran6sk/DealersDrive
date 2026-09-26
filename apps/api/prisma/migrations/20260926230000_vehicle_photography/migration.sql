-- Dealers-Drive's own photography of a vehicle (R45).
--
-- The operations team's record of where the shoot has got to, set by hand.
-- There is no StudioCar integration behind it; a batch id or external reference
-- can be added later as nullable columns without changing what reads `status`.
-- Absent means NOT_STARTED. Approval never reads this column — it checks the
-- uploaded images themselves.

CREATE TYPE "PhotographyStatus" AS ENUM (
    'NOT_STARTED',
    'SCHEDULED',
    'PHOTOGRAPHED',
    'PROCESSING',
    'READY'
);

CREATE TABLE "vehicle_photography" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "status" "PhotographyStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "note" TEXT,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_photography_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vehicle_photography_vehicleId_key" ON "vehicle_photography"("vehicleId");
CREATE INDEX "vehicle_photography_status_idx" ON "vehicle_photography"("status");

ALTER TABLE "vehicle_photography"
    ADD CONSTRAINT "vehicle_photography_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
