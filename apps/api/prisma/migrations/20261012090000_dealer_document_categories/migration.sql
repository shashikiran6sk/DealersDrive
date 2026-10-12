-- Two evidence categories (Personal Identity Proof, Business Identity Proof)
-- replace the fixed GST/PAN/address trio for new applications. Additive:
-- existing rows keep their type, status and private object; each is filed
-- under the category its type belongs to, and the legacy address proof under
-- SUPPORTING. Enum values are added outside the transaction because Postgres
-- refuses to use a value in the transaction that created it.
ALTER TYPE "DealerDocType" ADD VALUE IF NOT EXISTS 'AADHAAR';
ALTER TYPE "DealerDocType" ADD VALUE IF NOT EXISTS 'VOTER_ID';
ALTER TYPE "DealerDocType" ADD VALUE IF NOT EXISTS 'DRIVING_LICENCE';
ALTER TYPE "DealerDocType" ADD VALUE IF NOT EXISTS 'PASSPORT';
ALTER TYPE "DealerDocType" ADD VALUE IF NOT EXISTS 'SHOP_ESTABLISHMENT';
ALTER TYPE "DealerDocType" ADD VALUE IF NOT EXISTS 'UDYAM';
ALTER TYPE "DealerDocType" ADD VALUE IF NOT EXISTS 'TRADE_LICENSE';
ALTER TYPE "DealerDocType" ADD VALUE IF NOT EXISTS 'BUSINESS_REGISTRATION';
ALTER TYPE "DealerDocType" ADD VALUE IF NOT EXISTS 'PARTNERSHIP_REGISTRATION';
ALTER TYPE "DealerDocType" ADD VALUE IF NOT EXISTS 'RTO_DEALER_AUTHORIZATION';
ALTER TYPE "DealerDocType" ADD VALUE IF NOT EXISTS 'OTHER_BUSINESS_CERTIFICATE';

BEGIN;
CREATE TYPE "DealerDocCategory" AS ENUM ('PERSONAL_IDENTITY', 'BUSINESS_IDENTITY', 'SUPPORTING');

ALTER TABLE "dealer_documents"
  ADD COLUMN "category" "DealerDocCategory",
  ADD COLUMN "description" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "bytes" INTEGER,
  ADD COLUMN "uploadedAt" TIMESTAMP(3),
  ADD COLUMN "submissionCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "dealer_documents" SET "category" = (CASE "type"::text
  WHEN 'PAN_CARD' THEN 'PERSONAL_IDENTITY'
  WHEN 'GST_CERTIFICATE' THEN 'BUSINESS_IDENTITY'
  ELSE 'SUPPORTING' END)::"DealerDocCategory";
UPDATE "dealer_documents" SET "uploadedAt" = "createdAt", "submissionCount" = 1
  WHERE "fileName" IS NOT NULL AND "status" IN ('UPLOADED', 'VERIFIED');

ALTER TABLE "dealer_documents" ALTER COLUMN "category" SET NOT NULL;

DROP INDEX "dealer_documents_dealerId_type_key";
CREATE UNIQUE INDEX "dealer_documents_dealerId_category_key" ON "dealer_documents"("dealerId", "category");

ALTER TABLE "dealer_documents"
  ADD CONSTRAINT "dealer_documents_category_type_check" CHECK (
    ("category" = 'PERSONAL_IDENTITY' AND "type"::text IN ('AADHAAR', 'PAN_CARD', 'VOTER_ID', 'DRIVING_LICENCE', 'PASSPORT'))
    OR ("category" = 'BUSINESS_IDENTITY' AND "type"::text IN ('SHOP_ESTABLISHMENT', 'GST_CERTIFICATE', 'UDYAM', 'TRADE_LICENSE',
      'BUSINESS_REGISTRATION', 'PARTNERSHIP_REGISTRATION', 'RTO_DEALER_AUTHORIZATION', 'OTHER_BUSINESS_CERTIFICATE'))
    OR ("category" = 'SUPPORTING' AND "type"::text = 'ADDRESS_PROOF')
  ),
  ADD CONSTRAINT "dealer_documents_description_check" CHECK (
    ("description" IS NULL OR "type"::text = 'OTHER_BUSINESS_CERTIFICATE')
    AND ("type"::text <> 'OTHER_BUSINESS_CERTIFICATE' OR "fileName" IS NULL OR ("description" IS NOT NULL AND length(btrim("description")) >= 10))
  ),
  ADD CONSTRAINT "dealer_documents_file_check" CHECK (
    ("mimeType" IS NULL OR "mimeType" IN ('application/pdf', 'image/jpeg', 'image/png'))
    AND ("bytes" IS NULL OR ("bytes" > 0 AND "bytes" <= 5242880))
    AND "submissionCount" >= 0
  );
COMMIT;
