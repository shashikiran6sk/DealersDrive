-- Google sign-in for dealers (ARCHITECTURE §8.1 r3).
--
-- Three changes, and one of them needs saying out loud: `users.phone` becomes
-- nullable. A dealer now arrives from Google holding a verified email and
-- nothing else, and the alternative — writing a placeholder phone at callback
-- time — would let a stranger's first sign-in squat on the unique index that
-- protects a real dealership's number.

-- CreateEnum
CREATE TYPE "SessionScope" AS ENUM ('DEALER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE');

-- AlterTable: a session is issued for one seat and can never satisfy the other.
ALTER TABLE "sessions" ADD COLUMN "scope" "SessionScope" NOT NULL DEFAULT 'DEALER';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;

-- CreateTable
CREATE TABLE "oauth_identities" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "pictureUrl" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_identities_userId_idx" ON "oauth_identities"("userId");

-- The identity IS the pair. Google's `sub` is stable; the email is not, so the
-- email is stored for display and never used to find the account.
CREATE UNIQUE INDEX "oauth_identities_provider_providerSubject_key" ON "oauth_identities"("provider", "providerSubject");

-- AddForeignKey
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
