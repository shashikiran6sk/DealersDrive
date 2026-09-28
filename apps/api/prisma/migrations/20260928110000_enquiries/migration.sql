-- Enquiries come from signed-in customers (R64, revises F088).
--
-- One row per enquiry: which customer, which listing, and the dealership the
-- listing belongs to (copied on write, the tenant key every dealer read
-- filters on). No name and no phone: both are read from the customer's
-- `users` row when shown, so the number a dealer rings is always the proved
-- one (R39) and never text somebody typed. No vehicle id: a listing has
-- exactly one vehicle.
--
-- Three indexes, each for a read that exists: the dealer's inbox by status,
-- newest first (R66); the duplicate guard (this customer, this car, recently);
-- and the listing's own enquiries.

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED', 'SPAM');

-- CreateTable
CREATE TABLE "enquiries" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "message" TEXT,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "contactedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enquiries_dealerId_status_createdAt_idx" ON "enquiries"("dealerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "enquiries_customerId_listingId_createdAt_idx" ON "enquiries"("customerId", "listingId", "createdAt");

-- CreateIndex
CREATE INDEX "enquiries_listingId_idx" ON "enquiries"("listingId");

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
