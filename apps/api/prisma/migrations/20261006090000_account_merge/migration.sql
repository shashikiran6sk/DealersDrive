-- One person, one account, whichever door they came in by.
--
-- A customer who proved their phone and later signs in to the Dealer tab with
-- Google used to end up with two `users` rows, and step 1 refused to put the
-- phone on the second one. With proof of both identities in one request (the
-- Google session plus a fresh OTP, or the phone session plus a fresh Google
-- callback) the Google-only row is folded into the phone holder.
--
-- The absorbed row is never deleted: audit entries, sessions and attributions
-- written under its id keep resolving. It is marked DELETED and points at the
-- account that absorbed it.
--
-- Additive and nullable: every existing row reads NULL, which means "never
-- merged". No backfill, and a rollback of the application ignores the columns.
ALTER TABLE "users" ADD COLUMN "mergedIntoId" UUID;
ALTER TABLE "users" ADD COLUMN "mergedAt" TIMESTAMP(3);

ALTER TABLE "users" ADD CONSTRAINT "users_mergedIntoId_fkey"
  FOREIGN KEY ("mergedIntoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
