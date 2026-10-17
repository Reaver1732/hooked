-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Class_lastActivityAt_idx" ON "Class"("lastActivityAt");

-- Backfill: existing classes count as last active when they were created.
UPDATE "Class" SET "lastActivityAt" = "createdAt";
