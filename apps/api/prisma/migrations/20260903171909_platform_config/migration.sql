-- CreateTable
CREATE TABLE "platform_config" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "label" TEXT,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "updatedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("key")
);
