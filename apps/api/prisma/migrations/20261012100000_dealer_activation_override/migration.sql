-- How a dealership became ACTIVE (#299). STANDARD is approval after the
-- document review; MANUAL_OVERRIDE is a Super admin's recorded exception,
-- with who, when and why. Additive: every dealership that is ACTIVE or
-- SUSPENDED today reached it through standard approval and is marked so; no
-- other row, status, document or verification is touched.
BEGIN;
CREATE TYPE "DealerActivationMethod" AS ENUM ('STANDARD', 'MANUAL_OVERRIDE');

ALTER TABLE "dealers"
  ADD COLUMN "activationMethod" "DealerActivationMethod",
  ADD COLUMN "activationOverrideAt" TIMESTAMP(3),
  ADD COLUMN "activationOverrideById" UUID,
  ADD COLUMN "activationOverrideReason" TEXT;

UPDATE "dealers" SET "activationMethod" = 'STANDARD' WHERE "status" IN ('ACTIVE', 'SUSPENDED');

ALTER TABLE "dealers" ADD CONSTRAINT "dealers_activation_override_check" CHECK (
  "activationMethod" IS DISTINCT FROM 'MANUAL_OVERRIDE'
  OR ("activationOverrideAt" IS NOT NULL AND "activationOverrideById" IS NOT NULL
      AND length(btrim("activationOverrideReason")) >= 40)
);
COMMIT;
