-- Support requests (R90).
--
-- Two new tables and four new enum types. Additive only: no existing table,
-- column or row is touched, so the running code is unaffected until the code
-- that reads them ships.
--
--   support_tickets           one per request: the customer, a category, the
--                             subject and the opening description, status,
--                             support's priority, and an optional reference to
--                             one of the customer's own enquiries
--   support_ticket_messages   the conversation after the opening description,
--                             each row written by one side: CUSTOMER or SUPPORT
--
-- `number` is the human reference (DD-1042). SERIAL gives it a sequence, and
-- the sequence is restarted at 1001 below so the first reference a customer
-- sees is not DD-1. A sequence hands out each value once even to concurrent
-- inserts, which is the whole reason for it: a `count + 1` reference would
-- give two simultaneous requests the same number.
--
-- Indexes follow the reads that exist: a customer's own list newest activity
-- first, a ticket's conversation in order, and tickets that reference an
-- enquiry (also the FK lookup when an enquiry row is removed).

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('DEALER_ISSUE', 'VEHICLE_LISTING_ISSUE', 'ENQUIRY_ISSUE', 'ACCOUNT_ISSUE', 'TECHNICAL_ISSUE', 'GENERAL_QUESTION', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportMessageAuthor" AS ENUM ('CUSTOMER', 'SUPPORT');

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "customerId" UUID NOT NULL,
    "category" "SupportTicketCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "enquiryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorType" "SupportMessageAuthor" NOT NULL,
    "authorId" UUID,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_number_key" ON "support_tickets"("number");

-- CreateIndex
CREATE INDEX "support_tickets_customerId_updatedAt_idx" ON "support_tickets"("customerId", "updatedAt");

-- CreateIndex
CREATE INDEX "support_tickets_enquiryId_idx" ON "support_tickets"("enquiryId");

-- CreateIndex
CREATE INDEX "support_ticket_messages_ticketId_createdAt_idx" ON "support_ticket_messages"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The first reference is DD-1001.
ALTER SEQUENCE "support_tickets_number_seq" RESTART WITH 1001;
