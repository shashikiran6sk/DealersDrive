BEGIN;
ALTER TABLE "support_tickets" ADD COLUMN "unansweredCustomerMessages" integer NOT NULL DEFAULT 0;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_ticket_unanswered_quota" CHECK ("unansweredCustomerMessages" BETWEEN 0 AND 5);
ALTER TABLE "support_ticket_messages" ADD COLUMN "clientMessageId" uuid;
CREATE UNIQUE INDEX "support_ticket_messages_ticketId_authorType_clientMessageId_key"
ON "support_ticket_messages" ("ticketId", "authorType", "clientMessageId");
WITH last_reply AS (
 SELECT "ticketId", max("createdAt") AS replied_at FROM "support_ticket_messages"
 WHERE "authorType" = 'SUPPORT' GROUP BY "ticketId"
), unanswered AS (
 SELECT m."ticketId", least(5, count(*))::integer AS total
 FROM "support_ticket_messages" m LEFT JOIN last_reply r ON r."ticketId" = m."ticketId"
 WHERE m."authorType" = 'CUSTOMER' AND (r.replied_at IS NULL OR m."createdAt" >= r.replied_at)
 GROUP BY m."ticketId"
)
UPDATE "support_tickets" t SET "unansweredCustomerMessages" = u.total FROM unanswered u WHERE t.id = u."ticketId";
COMMIT;
