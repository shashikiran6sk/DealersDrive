-- One row per email the platform has decided to send (R40).
--
-- Three jobs, and the third is why it is a table rather than a log line:
--
--   1. Idempotency. `dedupeKey` is UNIQUE, and the worker claims a row before it
--      talks to Resend. A job pg-boss delivers twice — which it will, because
--      at-least-once is the only honest guarantee a queue can make — sends one
--      email, because the second insert loses the race against the index.
--
--      The key is derived from the *event* (`<template>:<subject id>:<recipient>`)
--      and never from the attempt. An id generated per job would be unique per
--      delivery and would deduplicate nothing.
--
--   2. Observability. Which dealer, which template, how many attempts, and the
--      provider's own message id. "Did the dealer get the approval email" is a
--      question support asks weekly, and answering it out of application logs
--      means grepping for an address.
--
--   3. A dead-letter somebody reads. pg-boss keeps failed jobs, but its archive
--      is a queue table nobody opens. `status = 'FAILED'` with the last error is
--      a list that can be worked.
--
-- `dealerId` is ON DELETE SET NULL rather than CASCADE: the record that a
-- message was sent outlives the dealership it was about. A rejected applicant
-- whose row is later purged should not take the evidence of what they were told
-- with them.

CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "lastError" TEXT,
    "dealerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- The whole idempotency guarantee, in one line.
CREATE UNIQUE INDEX "notification_deliveries_dedupeKey_key" ON "notification_deliveries"("dedupeKey");

-- The two reads this table has: the failed list, and one dealership's trail.
CREATE INDEX "notification_deliveries_status_createdAt_idx" ON "notification_deliveries"("status", "createdAt");
CREATE INDEX "notification_deliveries_dealerId_createdAt_idx" ON "notification_deliveries"("dealerId", "createdAt");

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_dealerId_fkey"
  FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
