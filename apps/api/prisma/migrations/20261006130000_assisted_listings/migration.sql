-- Assisted listing creation (R114): a Sales Representative prepares listing
-- drafts for a dealership they onboarded, and submits them once it is approved.
--
-- Two nullable attribution columns. Every existing vehicle and listing was the
-- dealer's own work and reads NULL, which is what it was. No backfill.
--
-- ON DELETE RESTRICT, as for dealers.assistedByMemberId: Admin Members are
-- disabled, never deleted, and attribution must not silently disappear.

ALTER TABLE "vehicles" ADD COLUMN "createdByMemberId" UUID;
ALTER TABLE "listings" ADD COLUMN "submittedByMemberId" UUID;

CREATE INDEX "vehicles_createdByMemberId_dealerId_idx" ON "vehicles"("createdByMemberId", "dealerId");

ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_createdByMemberId_fkey"
  FOREIGN KEY ("createdByMemberId") REFERENCES "admin_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "listings" ADD CONSTRAINT "listings_submittedByMemberId_fkey"
  FOREIGN KEY ("submittedByMemberId") REFERENCES "admin_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
