-- CreateEnum
CREATE TYPE "ChangeAction" AS ENUM ('CREATE', 'UPDATE', 'MERGE', 'DELETE');

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "ChangeAction" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousData" JSONB,
    "currentData" JSONB NOT NULL,
    "changes" JSONB,
    "changedBy" TEXT,
    "changeReason" TEXT,
    "mergedFrom" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeLog_entityType_entityId_idx" ON "ChangeLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ChangeLog_entityType_entityId_version_idx" ON "ChangeLog"("entityType", "entityId", "version");

-- CreateIndex
CREATE INDEX "ChangeLog_createdAt_idx" ON "ChangeLog"("createdAt");
