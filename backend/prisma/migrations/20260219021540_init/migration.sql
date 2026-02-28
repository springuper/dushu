-- CreateEnum
CREATE TYPE "PlaceSource" AS ENUM ('CHGIS', 'LLM', 'HYBRID', 'MANUAL');

-- AlterEnum
ALTER TYPE "ReviewItemType" ADD VALUE 'PLACE';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "importance" TEXT;

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "coordinatesLng" DOUBLE PRECISION,
    "coordinatesLat" DOUBLE PRECISION,
    "modernLocation" TEXT,
    "modernAddress" TEXT,
    "adminLevel1" TEXT,
    "adminLevel2" TEXT,
    "adminLevel3" TEXT,
    "geographicContext" TEXT,
    "featureType" TEXT,
    "source" "PlaceSource" NOT NULL DEFAULT 'CHGIS',
    "chgisId" TEXT,
    "sourceChapterIds" TEXT[],
    "timeRangeBegin" TEXT,
    "timeRangeEnd" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Place_name_key" ON "Place"("name");

-- CreateIndex
CREATE INDEX "Place_name_idx" ON "Place"("name");

-- CreateIndex
CREATE INDEX "Place_source_idx" ON "Place"("source");

-- CreateIndex
CREATE INDEX "Place_status_idx" ON "Place"("status");

-- CreateIndex
CREATE INDEX "Event_importance_idx" ON "Event"("importance");
