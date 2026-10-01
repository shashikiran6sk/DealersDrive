-- The admin's support ticket workspace (R91).
--
-- Additive only. One nullable column on support_tickets — the operator a
-- ticket is assigned to, NULL for unassigned, so every existing ticket is
-- simply unassigned and nothing needs backfilling — and one new table for
-- internal notes, which is separate from the conversation precisely so that
-- no query a customer route runs can ever select one.
--
-- Indexes follow the console's reads: the queue newest-activity first, with
-- and without a status tab, and "assigned to me / to one operator" by status.

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "assignedAdminId" UUID;

-- CreateTable
CREATE TABLE "support_ticket_notes" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorId" UUID,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_ticket_notes_ticketId_createdAt_idx" ON "support_ticket_notes"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_updatedAt_idx" ON "support_tickets"("updatedAt");

-- CreateIndex
CREATE INDEX "support_tickets_status_updatedAt_idx" ON "support_tickets"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "support_tickets_assignedAdminId_status_idx" ON "support_tickets"("assignedAdminId", "status");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_notes" ADD CONSTRAINT "support_ticket_notes_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_notes" ADD CONSTRAINT "support_ticket_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

