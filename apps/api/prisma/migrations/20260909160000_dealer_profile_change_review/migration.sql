-- A dealer's edit to their own public words waits for a moderator (R34).
--
-- The tagline and the service list are the two things a verified dealership may
-- still change about itself, and they are also the only free text it writes
-- that a buyer reads. A phone number typed into either reaches a public page
-- without going through `POST /v1/vehicles/:id/reveal-contact` — the one route
-- allowed to hand one out, rate-limited twice over and logged as a lead
-- (rule 7). Until now that edit was live the moment the dealer pressed Save.
--
-- So the edit becomes a proposal. The live columns on `dealers` are untouched
-- until an approval writes them, which is what makes a refusal a no-op rather
-- than a restore: nothing was taken away, so there is nothing to put back.

CREATE TYPE "ProfileChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "dealer_profile_changes" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "status" "ProfileChangeStatus" NOT NULL DEFAULT 'PENDING',
    -- NULL means "this request does not touch the tagline", which is
    -- unambiguous only because the field cannot be emptied: the floor in
    -- `DealerSelfUpdateInput` is ten characters. The empty array below carries
    -- its meaning for the same reason — the floor on the list is one entry.
    "tagline" TEXT,
    "specialities" TEXT[],
    "submittedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "decisionReason" TEXT,

    CONSTRAINT "dealer_profile_changes_pkey" PRIMARY KEY ("id")
);

-- The queue, oldest first: a moderator works the top of it.
CREATE INDEX "dealer_profile_changes_status_createdAt_idx"
    ON "dealer_profile_changes"("status", "createdAt");

-- One dealership's own history, and the newest-first read the dealer's profile
-- screen makes on every render.
CREATE INDEX "dealer_profile_changes_dealerId_createdAt_idx"
    ON "dealer_profile_changes"("dealerId", "createdAt");

ALTER TABLE "dealer_profile_changes"
    ADD CONSTRAINT "dealer_profile_changes_dealerId_fkey"
    FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── At most one request waiting per dealership ──────────────────────────────
--
-- A partial unique index, which Prisma's schema language cannot express, so it
-- is written here and the model carries a note pointing at it.
--
-- The service never relies on catching this: a dealer editing again *amends*
-- the request they already have, because two rows would make "what is this
-- dealership proposing" a question with two answers and a moderator would have
-- to approve them in order to get the result the dealer meant. The index is the
-- guarantee underneath that — two saves racing from two tabs cannot make a
-- second row, and the loser retries against the first.
--
-- It is partial on purpose. Decided rows accumulate forever, one per edit, and
-- they are the history of what this dealership has published.
CREATE UNIQUE INDEX "dealer_profile_changes_one_pending_per_dealer"
    ON "dealer_profile_changes"("dealerId")
    WHERE "status" = 'PENDING';
