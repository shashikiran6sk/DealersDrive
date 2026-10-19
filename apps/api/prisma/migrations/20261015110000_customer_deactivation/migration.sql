ALTER TABLE "users" ADD COLUMN "customerDeactivatedAt" TIMESTAMP(3);
ALTER TABLE "sessions" ADD COLUMN "authenticatedAt" TIMESTAMP(3);
