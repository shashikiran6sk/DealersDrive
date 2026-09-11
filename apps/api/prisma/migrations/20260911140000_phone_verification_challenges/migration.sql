CREATE TABLE "phone_verification_challenges" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    CONSTRAINT "phone_verification_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "phone_verification_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "phone_verification_challenges_phone_key" ON "phone_verification_challenges"("phone");
CREATE INDEX "phone_verification_challenges_userId_idx" ON "phone_verification_challenges"("userId");
