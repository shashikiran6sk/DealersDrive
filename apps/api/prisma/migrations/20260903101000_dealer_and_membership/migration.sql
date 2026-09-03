-- CreateEnum
CREATE TYPE "DealerStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DealerRole" AS ENUM ('OWNER', 'MANAGER', 'SALES');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'REMOVED');

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

-- CreateIndex
CREATE UNIQUE INDEX "dealers_slug_key" ON "dealers"("slug");

-- CreateIndex
CREATE INDEX "dealers_status_cityId_idx" ON "dealers"("status", "cityId");

-- CreateIndex
CREATE INDEX "dealer_members_userId_idx" ON "dealer_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_members_dealerId_userId_key" ON "dealer_members"("dealerId", "userId");

-- AddForeignKey
ALTER TABLE "dealer_members" ADD CONSTRAINT "dealer_members_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_members" ADD CONSTRAINT "dealer_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
