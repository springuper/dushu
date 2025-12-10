-- CreateEnum
CREATE TYPE "PersonRole" AS ENUM ('MONARCH', 'ADVISOR', 'GENERAL', 'CIVIL_OFFICIAL', 'MILITARY_OFFICIAL', 'RELATIVE', 'EUNUCH', 'OTHER');

-- CreateEnum
CREATE TYPE "Faction" AS ENUM ('HAN', 'CHU', 'NEUTRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BATTLE', 'POLITICAL', 'PERSONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TimePrecision" AS ENUM ('EXACT_DATE', 'MONTH', 'SEASON', 'YEAR', 'DECADE', 'APPROXIMATE');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewItemType" AS ENUM ('EVENT', 'PERSON');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MODIFIED');

-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('LLM_EXTRACT', 'MANUAL');

-- CreateEnum
CREATE TYPE "ChangeAction" AS ENUM ('CREATE', 'UPDATE', 'MERGE', 'DELETE');

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "author" TEXT,
    "dynasty" TEXT,
    "writtenYear" TEXT,
    "description" TEXT,
    "sourceUrl" TEXT,
    "totalChapters" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "totalParagraphs" INTEGER NOT NULL DEFAULT 0,
    "timeRangeStart" TEXT,
    "timeRangeEnd" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paragraph" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paragraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL,
    "paragraphId" TEXT NOT NULL,
    "targetText" TEXT NOT NULL,
    "explanation" VARCHAR(200) NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "timeRangeStart" TEXT NOT NULL,
    "timeRangeEnd" TEXT,
    "timePrecision" "TimePrecision" NOT NULL DEFAULT 'YEAR',
    "locationName" TEXT,
    "locationModernName" TEXT,
    "summary" TEXT NOT NULL,
    "impact" TEXT,
    "actors" JSONB NOT NULL DEFAULT '[]',
    "chapterId" TEXT NOT NULL,
    "relatedParagraphs" TEXT[],
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "role" "PersonRole" NOT NULL,
    "faction" "Faction" NOT NULL,
    "birthYear" TEXT,
    "deathYear" TEXT,
    "biography" TEXT NOT NULL,
    "portraitUrl" TEXT,
    "sourceChapterIds" TEXT[],
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "Book_name_idx" ON "Book"("name");

-- CreateIndex
CREATE INDEX "Book_status_idx" ON "Book"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Book_nameEn_key" ON "Book"("nameEn");

-- CreateIndex
CREATE INDEX "Chapter_bookId_idx" ON "Chapter"("bookId");

-- CreateIndex
CREATE INDEX "Chapter_order_idx" ON "Chapter"("order");

-- CreateIndex
CREATE INDEX "Paragraph_chapterId_idx" ON "Paragraph"("chapterId");

-- CreateIndex
CREATE INDEX "Paragraph_order_idx" ON "Paragraph"("order");

-- CreateIndex
CREATE INDEX "Annotation_paragraphId_idx" ON "Annotation"("paragraphId");

-- CreateIndex
CREATE INDEX "Event_chapterId_idx" ON "Event"("chapterId");

-- CreateIndex
CREATE INDEX "Event_name_idx" ON "Event"("name");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Event_timeRangeStart_idx" ON "Event"("timeRangeStart");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Person_name_idx" ON "Person"("name");

-- CreateIndex
CREATE INDEX "Person_faction_idx" ON "Person"("faction");

-- CreateIndex
CREATE INDEX "Person_role_idx" ON "Person"("role");

-- CreateIndex
CREATE INDEX "Person_status_idx" ON "Person"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE INDEX "Admin_username_idx" ON "Admin"("username");

-- CreateIndex
CREATE INDEX "ReviewItem_type_idx" ON "ReviewItem"("type");

-- CreateIndex
CREATE INDEX "ReviewItem_status_idx" ON "ReviewItem"("status");

-- CreateIndex
CREATE INDEX "ReviewItem_source_idx" ON "ReviewItem"("source");

-- CreateIndex
CREATE INDEX "ReviewItem_createdAt_idx" ON "ReviewItem"("createdAt");

-- CreateIndex
CREATE INDEX "ChangeLog_entityType_entityId_idx" ON "ChangeLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ChangeLog_entityType_entityId_version_idx" ON "ChangeLog"("entityType", "entityId", "version");

-- CreateIndex
CREATE INDEX "ChangeLog_createdAt_idx" ON "ChangeLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paragraph" ADD CONSTRAINT "Paragraph_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "Paragraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
