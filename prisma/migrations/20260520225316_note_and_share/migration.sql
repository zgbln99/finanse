-- Add boss note + public share token to Document
ALTER TABLE "Document" ADD COLUMN "note" TEXT;
ALTER TABLE "Document" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Document_shareToken_key" ON "Document"("shareToken");
