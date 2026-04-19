-- Add chapterId to Person (nullable until data is backfilled)
ALTER TABLE "Person" ADD COLUMN "chapterId" TEXT;

-- Add new columns to Person
ALTER TABLE "Person" ADD COLUMN "birthDate" TEXT;
ALTER TABLE "Person" ADD COLUMN "birthPlace" TEXT;
ALTER TABLE "Person" ADD COLUMN "deathPlace" TEXT;
ALTER TABLE "Person" ADD COLUMN "nativePlace" TEXT;
ALTER TABLE "Person" ADD COLUMN "zi" TEXT;
ALTER TABLE "Person" ADD COLUMN "relatedParagraphIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add chapterId to Place (nullable until data is backfilled)
ALTER TABLE "Place" ADD COLUMN "chapterId" TEXT;

-- Add relatedParagraphIds to Place
ALTER TABLE "Place" ADD COLUMN "relatedParagraphIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add indexes
CREATE INDEX "Person_chapterId_idx" ON "Person"("chapterId");
CREATE UNIQUE INDEX "Person_chapterId_name_key" ON "Person"("chapterId", "name");

CREATE INDEX "Place_chapterId_idx" ON "Place"("chapterId");
CREATE UNIQUE INDEX "Place_chapterId_name_key" ON "Place"("chapterId", "name");

-- Add foreign key constraints (run after backfilling chapterId data)
-- ALTER TABLE "Person" ADD CONSTRAINT "Person_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE;
-- ALTER TABLE "Place" ADD CONSTRAINT "Place_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE;

-- Remove obsolete columns (only after chapterId is backfilled and FK is added)
-- ALTER TABLE "Person" DROP COLUMN "sourceChapterIds";
-- ALTER TABLE "Place" DROP COLUMN "sourceChapterIds";