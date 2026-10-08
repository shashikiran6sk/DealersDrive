BEGIN;

-- CreateEnum
CREATE TYPE "StorefrontTheme" AS ENUM ('LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "StorefrontStatus" AS ENUM ('DRAFT', 'PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "StorefrontDomainKind" AS ENUM ('DEFAULT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StorefrontDomainStatus" AS ENUM ('PENDING', 'VERIFICATION_REQUIRED', 'ACTIVE', 'FAILED', 'REMOVAL_PENDING', 'REMOVED');

-- CreateEnum
CREATE TYPE "EnquirySource" AS ENUM ('MARKETPLACE', 'DEALER_WEBSITE');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "marketplacePublished" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "storefrontPublished" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "enquiries" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "source" "EnquirySource" NOT NULL DEFAULT 'MARKETPLACE',
ADD COLUMN     "storefrontHostname" TEXT,
ADD COLUMN     "storefrontId" UUID;

-- CreateTable
CREATE TABLE "dealer_storefronts" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "subdomain" VARCHAR(63) NOT NULL,
    "status" "StorefrontStatus" NOT NULL DEFAULT 'DRAFT',
    "theme" "StorefrontTheme" NOT NULL DEFAULT 'LIGHT',
    "displayName" VARCHAR(100) NOT NULL,
    "accentColor" VARCHAR(7) NOT NULL DEFAULT '#155e75',
    "headline" VARCHAR(140) NOT NULL DEFAULT '',
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "about" VARCHAR(3000) NOT NULL DEFAULT '',
    "contactPhone" TEXT,
    "whatsappPhone" TEXT,
    "mapsUrl" TEXT,
    "socialUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seoTitle" VARCHAR(70) NOT NULL DEFAULT '',
    "seoDescription" VARCHAR(160) NOT NULL DEFAULT '',
    "logoMediaId" UUID,
    "heroMediaId" UUID,
    "yardMediaIds" UUID[] DEFAULT ARRAY[]::UUID[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_storefronts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_domains" (
    "id" UUID NOT NULL,
    "storefrontId" UUID NOT NULL,
    "hostname" VARCHAR(253) NOT NULL,
    "kind" "StorefrontDomainKind" NOT NULL,
    "status" "StorefrontDomainStatus" NOT NULL DEFAULT 'PENDING',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "ownershipToken" TEXT,
    "ownershipVerifiedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "certificateReady" BOOLEAN NOT NULL DEFAULT false,
    "verificationName" TEXT,
    "verificationValue" TEXT,
    "routingType" TEXT,
    "routingName" TEXT,
    "routingValue" TEXT,
    "lastError" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storefront_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dealer_storefronts_dealerId_key" ON "dealer_storefronts"("dealerId");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_storefronts_subdomain_key" ON "dealer_storefronts"("subdomain");

-- CreateIndex
CREATE INDEX "dealer_storefronts_status_dealerId_idx" ON "dealer_storefronts"("status", "dealerId");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_domains_hostname_key" ON "storefront_domains"("hostname");

-- CreateIndex
CREATE INDEX "storefront_domains_storefrontId_status_idx" ON "storefront_domains"("storefrontId", "status");

-- CreateIndex
CREATE INDEX "enquiries_storefrontId_createdAt_idx" ON "enquiries"("storefrontId", "createdAt");

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "dealer_storefronts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_storefronts" ADD CONSTRAINT "dealer_storefronts_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_domains" ADD CONSTRAINT "storefront_domains_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "dealer_storefronts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The database is the final normalization and concurrent reservation boundary.
ALTER TABLE "dealer_storefronts" ADD CONSTRAINT "storefront_subdomain_normalized"
  CHECK (length("subdomain") BETWEEN 3 AND 63 AND "subdomain" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND "subdomain" NOT IN ('www','api','admin','auth','mail','support','dashboard','static',
      'media','assets','app','localhost','dev','preview','staging','production','storefront',
      'dealer','dealers','cars','car','sales','internal','health','status','cdn','uploads',
      'billing','payments','help','legal','privacy','terms','account','login','register',
      'smtp','imap','pop','ftp','ns1','ns2'));
ALTER TABLE "storefront_domains" ADD CONSTRAINT "storefront_hostname_normalized"
  CHECK ("hostname" ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
    AND "hostname" !~ '(^|\.)xn--' AND "hostname" !~ '\.(localhost|local|internal|invalid|test)$');
ALTER TABLE "dealer_storefronts" ADD CONSTRAINT "storefront_branding_bounds"
  CHECK ("accentColor" ~ '^#[0-9a-f]{6}$' AND cardinality("yardMediaIds") <= 6
    AND cardinality("socialUrls") <= 5);
ALTER TABLE "storefront_domains" ADD CONSTRAINT "storefront_active_domain_verified"
  CHECK ("status" <> 'ACTIVE' OR ("verifiedAt" IS NOT NULL AND "certificateReady"
    AND ("kind" = 'DEFAULT' OR "ownershipVerifiedAt" IS NOT NULL)));
ALTER TABLE "storefront_domains" ADD CONSTRAINT "storefront_primary_domain_active"
  CHECK (NOT "isPrimary" OR "status" = 'ACTIVE');
CREATE UNIQUE INDEX "storefront_one_primary_domain" ON "storefront_domains" ("storefrontId") WHERE "isPrimary";
CREATE UNIQUE INDEX "storefront_one_default_domain" ON "storefront_domains" ("storefrontId") WHERE "kind" = 'DEFAULT';
CREATE INDEX "listings_storefront_public_idx" ON "listings" ("dealerId", "publishedAt", "id")
  WHERE "storefrontPublished" AND "status" IN ('ACTIVE', 'RESERVED');

COMMIT;
