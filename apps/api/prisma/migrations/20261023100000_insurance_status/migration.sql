-- Convert coverage types to a manually maintained status. Unknown coverage stays
-- NULL so the existing completeness/issue list asks an admin to confirm it.
-- Retain the historical expiry column for review and recovery; new APIs never write it.
BEGIN;
CREATE TYPE "InsuranceType_new" AS ENUM ('NONE', 'LIVE');
ALTER TABLE "vehicles" ALTER COLUMN "insuranceType" TYPE "InsuranceType_new"
USING (CASE
  WHEN "insuranceType"::text = 'NONE' THEN 'NONE'
  WHEN "insuranceType" IS NULL OR "insuranceValidUntil" IS NULL THEN NULL
  WHEN "insuranceValidUntil" >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date THEN 'LIVE'
  ELSE 'NONE'
END)::"InsuranceType_new";
DROP TYPE "InsuranceType";
ALTER TYPE "InsuranceType_new" RENAME TO "InsuranceType";
COMMIT;
