-- CreateEnum
CREATE TYPE "DealerStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DealerRole" AS ENUM ('OWNER', 'MANAGER', 'SALES');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'REMOVED');

-- CreateEnum
CREATE TYPE "DealerDocType" AS ENUM ('GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('REQUIRED', 'UPLOADING', 'UPLOADED', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "dealers" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "about" TEXT,
    "tagline" TEXT,
    "logoMediaId" UUID,
    "coverMediaId" UUID,
    "status" "DealerStatus" NOT NULL DEFAULT 'DRAFT',
    "cityId" UUID,
    "addressLine" TEXT,
    "pincode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "landline" TEXT,
    "workingHours" JSONB,
    "establishedYear" INTEGER,
    "specialities" TEXT[],
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "creditsHeld" INTEGER NOT NULL DEFAULT 0,
    "activeListings" INTEGER NOT NULL DEFAULT 0,
    "medianResponseMins" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "statusReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_members" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "DealerRole" NOT NULL,
    "permissions" TEXT[],
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "dealer_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_documents" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "type" "DealerDocType" NOT NULL,
    "mediaId" UUID,
    "fileName" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'REQUIRED',
    "rejectionReason" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dealers_slug_key" ON "dealers"("slug");

-- CreateIndex
CREATE INDEX "dealers_status_cityId_idx" ON "dealers"("status", "cityId");

-- CreateIndex
CREATE INDEX "dealer_members_userId_idx" ON "dealer_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_members_dealerId_userId_key" ON "dealer_members"("dealerId", "userId");

-- CreateIndex
CREATE INDEX "dealer_documents_status_createdAt_idx" ON "dealer_documents"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_documents_dealerId_type_key" ON "dealer_documents"("dealerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- AddForeignKey
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_members" ADD CONSTRAINT "dealer_members_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_members" ADD CONSTRAINT "dealer_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_documents" ADD CONSTRAINT "dealer_documents_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
