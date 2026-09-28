-- One spelling of a phone number (R59).
--
-- A verified phone becomes a way to sign in, beside Google. `users.phone` is
-- that identity — written only by a completed OTP (R39) — and its unique index
-- is what stops one handset from opening two accounts. But the index is over
-- the stored string, so it only protects one handset if every writer stores
-- the same string. `normaliseIndianMobile` (contracts) is that form, `+91` and
-- ten digits starting 6-9, and this CHECK holds every writer to it, including
-- one that forgot to normalise.
--
-- It cannot fail on existing data: `users.phone` has only ever been written
-- through `toE164` of a number `IndianMobile` had already validated.
--
-- Deliberately *not* here: a unique index on `oauth_identities(userId,
-- provider)`. The admin sign-in matches an allow-listed address by email and
-- can attach a second GOOGLE subject to one user (a Google account deleted and
-- re-created under the same address has a new `sub`). Linking Google to an
-- account that began with a phone serialises on the user row instead
-- (`SELECT … FOR UPDATE` in `identity.service.ts`), which gives the same
-- guarantee for the one path that needs it.

ALTER TABLE "users"
  ADD CONSTRAINT "users_phone_canonical" CHECK ("phone" IS NULL OR "phone" ~ '^\+91[6-9][0-9]{9}$');
