-- Payment tracking + anomaly/duplicate flags
ALTER TABLE "Document" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "isDuplicate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN "isAnomaly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN "anomalyReason" TEXT;
