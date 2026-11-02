BEGIN;

ALTER TABLE "sessions" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "sessions" SET "lastSeenAt" = "createdAt";

CREATE INDEX "sessions_lastSeenAt_idx" ON "sessions"("lastSeenAt");

COMMIT;
