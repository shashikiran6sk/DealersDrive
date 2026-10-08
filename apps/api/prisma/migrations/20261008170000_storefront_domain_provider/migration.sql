BEGIN;
ALTER TABLE "storefront_domains" ADD COLUMN "providerAttachedAt" TIMESTAMP(3);
CREATE INDEX "storefront_domain_refresh_idx" ON "storefront_domains" ("checkedAt", "id")
  WHERE "kind" = 'CUSTOM' AND "status" IN ('ACTIVE', 'REMOVAL_PENDING');
COMMIT;
