-- CreateEnum
CREATE TYPE "PersonRole" AS ENUM ('MONARCH', 'ADVISOR', 'GENERAL', 'CIVIL_OFFICIAL', 'MILITARY_OFFICIAL', 'RELATIVE', 'EUNUCH', 'OTHER');

-- CreateEnum
CREATE TYPE "Faction" AS ENUM ('HAN', 'CHU', 'NEUTRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('ALLY', 'ENEMY', 'SUPERIOR', 'SUBORDINATE', 'KINSHIP', 'TEACHER_STUDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PlaceType" AS ENUM ('CITY', 'BATTLEFIELD', 'RIVER', 'MOUNTAIN', 'REGION', 'OTHER');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BATTLE', 'POLITICAL', 'PERSONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PUBLISHED', 'REJECTED');

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
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "role" "PersonRole" NOT NULL,
    "faction" "Faction" NOT NULL,
    "birthYear" TEXT,
    "deathYear" TEXT,
    "activePeriodStart" TEXT,
    "activePeriodEnd" TEXT,
    "biography" TEXT NOT NULL,
    "keyEvents" TEXT[],
    "portraitUrl" TEXT,
    "firstAppearanceChapterId" TEXT,
    "firstAppearanceParagraphId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "RelationshipType" NOT NULL,
    "description" TEXT NOT NULL,
    "referenceChapters" TEXT[],
    "confidence" INTEGER NOT NULL DEFAULT 3,
    "timeRangeStart" TEXT,
    "timeRangeEnd" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modernName" TEXT NOT NULL,
    "coordinatesLng" DOUBLE PRECISION NOT NULL,
    "coordinatesLat" DOUBLE PRECISION NOT NULL,
    "type" "PlaceType" NOT NULL,
    "faction" "Faction",
    "relatedEvents" TEXT[],
    "description" TEXT NOT NULL,
    "firstAppearanceChapterId" TEXT,
    "firstAppearanceParagraphId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timeRangeStart" TEXT NOT NULL,
    "timeRangeEnd" TEXT,
    "timeRangeLunar" TEXT,
    "locationId" TEXT,
    "summary" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "impact" TEXT,
    "relatedParagraphs" TEXT[],
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chapterId" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParagraphPerson" (
    "id" TEXT NOT NULL,
    "paragraphId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParagraphPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParagraphPlace" (
    "id" TEXT NOT NULL,
    "paragraphId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParagraphPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParagraphEvent" (
    "id" TEXT NOT NULL,
    "paragraphId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParagraphEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "Person_name_idx" ON "Person"("name");

-- CreateIndex
CREATE INDEX "Person_faction_idx" ON "Person"("faction");

-- CreateIndex
CREATE INDEX "Person_role_idx" ON "Person"("role");

-- CreateIndex
CREATE INDEX "Person_status_idx" ON "Person"("status");

-- CreateIndex
CREATE INDEX "Relationship_sourceId_idx" ON "Relationship"("sourceId");

-- CreateIndex
CREATE INDEX "Relationship_targetId_idx" ON "Relationship"("targetId");

-- CreateIndex
CREATE INDEX "Relationship_type_idx" ON "Relationship"("type");

-- CreateIndex
CREATE INDEX "Relationship_status_idx" ON "Relationship"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_sourceId_targetId_type_key" ON "Relationship"("sourceId", "targetId", "type");

-- CreateIndex
CREATE INDEX "Place_name_idx" ON "Place"("name");

-- CreateIndex
CREATE INDEX "Place_type_idx" ON "Place"("type");

-- CreateIndex
CREATE INDEX "Place_faction_idx" ON "Place"("faction");

-- CreateIndex
CREATE INDEX "Place_status_idx" ON "Place"("status");

-- CreateIndex
CREATE INDEX "Event_name_idx" ON "Event"("name");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Event_locationId_idx" ON "Event"("locationId");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "ParagraphPerson_paragraphId_idx" ON "ParagraphPerson"("paragraphId");

-- CreateIndex
CREATE INDEX "ParagraphPerson_personId_idx" ON "ParagraphPerson"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "ParagraphPerson_paragraphId_personId_key" ON "ParagraphPerson"("paragraphId", "personId");

-- CreateIndex
CREATE INDEX "ParagraphPlace_paragraphId_idx" ON "ParagraphPlace"("paragraphId");

-- CreateIndex
CREATE INDEX "ParagraphPlace_placeId_idx" ON "ParagraphPlace"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "ParagraphPlace_paragraphId_placeId_key" ON "ParagraphPlace"("paragraphId", "placeId");

-- CreateIndex
CREATE INDEX "ParagraphEvent_paragraphId_idx" ON "ParagraphEvent"("paragraphId");

-- CreateIndex
CREATE INDEX "ParagraphEvent_eventId_idx" ON "ParagraphEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ParagraphEvent_paragraphId_eventId_key" ON "ParagraphEvent"("paragraphId", "eventId");

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_idx" ON "EventParticipant"("eventId");

-- CreateIndex
CREATE INDEX "EventParticipant_personId_idx" ON "EventParticipant"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_personId_key" ON "EventParticipant"("eventId", "personId");

-- AddForeignKey
ALTER TABLE "Paragraph" ADD CONSTRAINT "Paragraph_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "Paragraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParagraphPerson" ADD CONSTRAINT "ParagraphPerson_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "Paragraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParagraphPerson" ADD CONSTRAINT "ParagraphPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParagraphPlace" ADD CONSTRAINT "ParagraphPlace_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "Paragraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParagraphPlace" ADD CONSTRAINT "ParagraphPlace_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParagraphEvent" ADD CONSTRAINT "ParagraphEvent_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "Paragraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParagraphEvent" ADD CONSTRAINT "ParagraphEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
