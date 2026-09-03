-- CreateTable
CREATE TABLE "cache_counter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "reset_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cache_counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "cache_version" (
    "namespace" TEXT NOT NULL,
    "version" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cache_version_pkey" PRIMARY KEY ("namespace")
);

-- CreateIndex
CREATE INDEX "cache_counter_reset_at_idx" ON "cache_counter"("reset_at");
