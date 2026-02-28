-- AlterTable
ALTER TABLE "Paragraph" ADD COLUMN "translation" TEXT;

-- CreateTable
CREATE TABLE "TextMention" (
    "id" TEXT NOT NULL,
    "paragraphId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "startIndex" INTEGER NOT NULL,
    "endIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TextMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TextMention_paragraphId_startIndex_endIndex_entityType_entityId_key" ON "TextMention"("paragraphId", "startIndex", "endIndex", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "TextMention_paragraphId_idx" ON "TextMention"("paragraphId");

-- CreateIndex
CREATE INDEX "TextMention_entityType_entityId_idx" ON "TextMention"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "TextMention" ADD CONSTRAINT "TextMention_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "Paragraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
