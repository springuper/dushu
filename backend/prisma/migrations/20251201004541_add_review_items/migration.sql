-- CreateEnum
CREATE TYPE "ReviewItemType" AS ENUM ('PERSON', 'RELATIONSHIP', 'PLACE', 'EVENT');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MODIFIED');

-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('LLM_EXTRACT', 'MANUAL');

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "type" "ReviewItemType" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "source" "ReviewSource" NOT NULL DEFAULT 'LLM_EXTRACT',
    "originalData" JSONB NOT NULL,
    "modifiedData" JSONB,
    "reviewerNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewItem_type_idx" ON "ReviewItem"("type");

-- CreateIndex
CREATE INDEX "ReviewItem_status_idx" ON "ReviewItem"("status");

-- CreateIndex
CREATE INDEX "ReviewItem_source_idx" ON "ReviewItem"("source");

-- CreateIndex
CREATE INDEX "ReviewItem_createdAt_idx" ON "ReviewItem"("createdAt");
