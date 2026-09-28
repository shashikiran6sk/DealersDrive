-- Customers (R62).
--
-- A buyer signs in with their phone and nothing else. They are ordinary
-- `users` rows — the phone is `users.phone`, the identity R59 made the unique
-- key for a proved handset — with a CUSTOMER seat, and sessions of a CUSTOMER
-- scope in the same `sessions` table the dealer and admin consoles use.
--
-- Additive only: two enum values, no table, no column, nothing backfilled.
-- `ADD VALUE` is safe inside the migration's transaction because nothing in
-- it uses the new values.

ALTER TYPE "SessionScope" ADD VALUE 'CUSTOMER';

ALTER TYPE "PlatformRole" ADD VALUE 'CUSTOMER';
