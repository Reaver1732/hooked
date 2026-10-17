-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "playerCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill counts for classes that already have players.
UPDATE "Class" c SET "playerCount" = (SELECT count(*) FROM "Player" p WHERE p."classId" = c.id);
