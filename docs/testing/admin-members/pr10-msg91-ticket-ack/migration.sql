-- R118: one delivery log for email and SMS.
-- Additive: a new enum and a NOT NULL column whose default backfills every
-- existing row as EMAIL in the same statement. No table rewrite beyond the
-- default, no index change, nothing dropped.
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS');

ALTER TABLE "notification_deliveries"
  ADD COLUMN "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL';
