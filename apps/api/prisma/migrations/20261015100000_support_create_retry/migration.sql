ALTER TABLE "support_tickets"
  ADD COLUMN "clientRequestId" UUID,
  ADD COLUMN "requestDigest" TEXT;

CREATE UNIQUE INDEX "support_tickets_customerId_clientRequestId_key"
  ON "support_tickets"("customerId", "clientRequestId");
