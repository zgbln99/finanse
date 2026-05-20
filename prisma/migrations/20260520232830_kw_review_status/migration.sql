-- Single KW review verdict per document (ok / nok / null)
ALTER TABLE "Document" ADD COLUMN "reviewStatus" TEXT;
