ALTER TABLE "dealers"
  ADD COLUMN "landlineConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "landlineApprovedAt" TIMESTAMP(3);
ALTER TABLE "dealer_profile_changes"
  ADD COLUMN "landline" TEXT,
  ADD COLUMN "landlineChanged" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "call_leads" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "firstRevealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRevealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revealCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "call_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "call_leads_customerId_listingId_key" ON "call_leads"("customerId", "listingId");
CREATE INDEX "call_leads_dealerId_lastRevealedAt_idx" ON "call_leads"("dealerId", "lastRevealedAt");
CREATE INDEX "call_leads_lastRevealedAt_idx" ON "call_leads"("lastRevealedAt");
CREATE INDEX "call_leads_listingId_idx" ON "call_leads"("listingId");

ALTER TABLE "call_leads" ADD CONSTRAINT "call_leads_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_leads" ADD CONSTRAINT "call_leads_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_leads" ADD CONSTRAINT "call_leads_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
