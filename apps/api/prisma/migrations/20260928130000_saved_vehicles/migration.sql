-- Saved cars (R74, revises F087): a customer's shortlist, on the server.
--
-- One row per customer per listing. The unique pair is what makes a double
-- tap save once, and (customerId, createdAt) is the customer's list, newest
-- first. A listing's lifecycle never deletes a row: a saved car that is sold
-- or withdrawn stays saved and is shown as such.

CREATE TABLE "saved_vehicles" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_vehicles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_vehicles_customerId_listingId_key" ON "saved_vehicles"("customerId", "listingId");
CREATE INDEX "saved_vehicles_customerId_createdAt_idx" ON "saved_vehicles"("customerId", "createdAt");
CREATE INDEX "saved_vehicles_listingId_idx" ON "saved_vehicles"("listingId");

ALTER TABLE "saved_vehicles" ADD CONSTRAINT "saved_vehicles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_vehicles" ADD CONSTRAINT "saved_vehicles_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
