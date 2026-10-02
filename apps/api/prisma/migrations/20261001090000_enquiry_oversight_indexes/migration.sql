-- Admin oversight of enquiries (R89).
--
-- Additive only: two indexes, no column, no data change. The oversight list
-- reads enquiries across every dealership newest first, with or without one
-- status tab, so it needs the two orderings the existing indexes cannot give
-- it — every one of those leads with dealerId, customerId or listingId.
--
--   (createdAt)          the "All" tab and every search, newest first
--   (status, createdAt)  one status tab, newest first

-- CreateIndex
CREATE INDEX "enquiries_createdAt_idx" ON "enquiries"("createdAt");

-- CreateIndex
CREATE INDEX "enquiries_status_createdAt_idx" ON "enquiries"("status", "createdAt");
