-- A dealership holds a registration number once (F056, R46).
--
-- The canonical form `normaliseRegistration` produces is what makes this index
-- mean anything: `KA-01-AB-1234`, `ka01ab1234` and `KA 1 AB 1234` are all
-- stored as `KA01AB1234`, so a unique index over the column is a unique index
-- over the car.
--
-- It is partial on `releasedAt IS NULL`. A vehicle releases its registration
-- when it leaves the dealership's hands — sold, removed or rejected (R47) — and
-- a car bought back, or re-entered after a rejection, must be enterable again.
-- Until the listing lifecycle lands nothing sets `releasedAt`, so every row
-- holds its number.
--
-- The service reads first so it can answer with a sentence; this index is what
-- holds when two tabs save the same plate at once.

ALTER TABLE "vehicles" ADD COLUMN "releasedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "vehicles_dealerId_registrationNumber_held_key"
    ON "vehicles"("dealerId", "registrationNumber")
    WHERE "releasedAt" IS NULL;
