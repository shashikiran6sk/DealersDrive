BEGIN;
CREATE TABLE "admin_phone_credentials" (
 "id" uuid PRIMARY KEY, "userId" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE RESTRICT,
 "phone" text NOT NULL UNIQUE CHECK ("phone" ~ '^\+91[6-9][0-9]{9}$'),
 "phoneVerifiedAt" timestamp(3) NOT NULL, "version" integer NOT NULL DEFAULT 1 CHECK ("version" > 0),
 "revokedAt" timestamp(3), "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "admin_otp_challenges" (
 "id" uuid PRIMARY KEY, "purpose" text NOT NULL CHECK ("purpose" IN ('ENROLL','LOGIN')),
 "phone" text NOT NULL CHECK ("phone" ~ '^\+91[6-9][0-9]{9}$'),
 "userId" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
 "sessionId" uuid REFERENCES "sessions"("id") ON DELETE RESTRICT,
 "credentialId" uuid REFERENCES "admin_phone_credentials"("id") ON DELETE RESTRICT,
 "credentialVersion" integer, "browserTokenHash" text NOT NULL,
 "attempts" integer NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 5),
 "expiresAt" timestamp(3) NOT NULL, "consumedAt" timestamp(3), "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (("purpose" = 'LOGIN' AND "sessionId" IS NULL) OR ("purpose" = 'ENROLL' AND "sessionId" IS NOT NULL AND "userId" IS NOT NULL)),
 CHECK (("credentialId" IS NULL AND "credentialVersion" IS NULL) OR ("credentialId" IS NOT NULL AND "credentialVersion" IS NOT NULL AND "credentialVersion" > 0)),
 CHECK ("expiresAt" > "createdAt")
);
CREATE INDEX "admin_otp_challenges_phone_createdAt_idx" ON "admin_otp_challenges"("phone","createdAt");
CREATE INDEX "admin_otp_challenges_expiresAt_idx" ON "admin_otp_challenges"("expiresAt");
CREATE TABLE "admin_otp_redemptions" (
 "tokenHash" text PRIMARY KEY, "challengeId" uuid NOT NULL UNIQUE REFERENCES "admin_otp_challenges"("id") ON DELETE RESTRICT,
 "redeemedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;
