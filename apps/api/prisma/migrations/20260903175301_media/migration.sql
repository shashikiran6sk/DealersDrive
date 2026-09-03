-- CreateEnum
CREATE TYPE "MediaOwner" AS ENUM ('VEHICLE', 'DEALER_LOGO', 'DEALER_COVER', 'DEALER_DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'ORPHAN');

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "dealerId" UUID,
    "ownerType" "MediaOwner" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurhash" TEXT,
    "variants" JSONB NOT NULL DEFAULT '{}',
    "fileName" TEXT,
    "warnings" TEXT[],
    "uploadedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_storageKey_key" ON "media"("storageKey");

-- CreateIndex
CREATE INDEX "media_status_createdAt_idx" ON "media"("status", "createdAt");
