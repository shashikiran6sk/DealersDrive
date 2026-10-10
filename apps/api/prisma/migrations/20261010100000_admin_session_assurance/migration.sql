BEGIN;
ALTER TABLE "sessions" ADD COLUMN "authenticationMethod" text;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_authentication_method"
CHECK ("authenticationMethod" IS NULL OR "authenticationMethod" IN ('GOOGLE', 'PHONE_OTP'));
-- Historical sessions remain unknown: credential enrollment requires fresh Google proof.
COMMIT;
