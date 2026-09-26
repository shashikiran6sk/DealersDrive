-- The vehicle a dealership enters by hand (F055, as revised by R45 and R46).
--
-- Every descriptive column is nullable: a draft is saved one wizard step at a
-- time, and "complete enough to submit" is a rule in `packages/contracts`, not a
-- NOT NULL here. What the database does own is the range of each value — a
-- negative odometer or a zero price is wrong in every state, so it is refused
-- here as well as by the schema in front of it.
--
-- No image columns. Listing photographs are Dealers-Drive's (R45) and arrive
-- with the admin media model.

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID', 'LPG');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "BodyType" AS ENUM ('HATCHBACK', 'SEDAN', 'SUV', 'MUV', 'LUXURY');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('COMPREHENSIVE', 'THIRD_PARTY', 'NONE');

-- CreateEnum
CREATE TYPE "PriceNegotiability" AS ENUM ('SLIGHTLY', 'FIXED');

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "rtoCode" TEXT,
    "make" TEXT,
    "model" TEXT,
    "variant" TEXT,
    "manufacturingYear" INTEGER,
    "registrationYear" INTEGER,
    "fuelType" "FuelType",
    "transmission" "Transmission",
    "bodyType" "BodyType",
    "kilometersDriven" INTEGER,
    "ownerCount" INTEGER,
    "color" TEXT,
    "insuranceType" "InsuranceType",
    "insuranceValidUntil" DATE,
    "pricePaise" BIGINT,
    "negotiability" "PriceNegotiability",
    "description" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicles_dealerId_createdAt_idx" ON "vehicles"("dealerId", "createdAt");

-- CreateIndex
CREATE INDEX "vehicles_registrationNumber_idx" ON "vehicles"("registrationNumber");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Ranges that hold in every state ─────────────────────────────────────────
ALTER TABLE "vehicles"
    ADD CONSTRAINT "vehicles_kilometersDriven_check" CHECK ("kilometersDriven" >= 0),
    ADD CONSTRAINT "vehicles_ownerCount_check" CHECK ("ownerCount" BETWEEN 1 AND 20),
    ADD CONSTRAINT "vehicles_pricePaise_check" CHECK ("pricePaise" > 0),
    ADD CONSTRAINT "vehicles_manufacturingYear_check" CHECK ("manufacturingYear" BETWEEN 1950 AND 2100),
    ADD CONSTRAINT "vehicles_registrationYear_check" CHECK ("registrationYear" BETWEEN 1950 AND 2100);
