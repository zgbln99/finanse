-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'approved';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "gf1ApprovedAt" TIMESTAMP(3),
ADD COLUMN     "gf1ApprovedBy" TEXT,
ADD COLUMN     "gf2ApprovedAt" TIMESTAMP(3),
ADD COLUMN     "gf2ApprovedBy" TEXT;
