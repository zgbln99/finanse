-- Auto-tagging rules
CREATE TABLE "TagRule" (
    "id" TEXT NOT NULL,
    "contains" TEXT NOT NULL,
    "field" TEXT NOT NULL DEFAULT 'vendor',
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TagRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TagRule_tagId_idx" ON "TagRule"("tagId");
ALTER TABLE "TagRule" ADD CONSTRAINT "TagRule_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
