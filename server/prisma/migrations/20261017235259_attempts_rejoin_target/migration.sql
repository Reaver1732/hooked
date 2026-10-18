-- Class: target score for "Passed" (default 80%).
ALTER TABLE "Class" ADD COLUMN     "targetPercent" INTEGER NOT NULL DEFAULT 80;

-- Player: hashed rejoin code. Existing players have none until a teacher resets it.
ALTER TABLE "Player" ADD COLUMN     "rejoinCodeHash" TEXT;

-- Attempt: one play-through of the message set.
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Attempt_playerId_idx" ON "Attempt"("playerId");
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Answers move into attempts. Add the column as nullable, backfill, then require it.
ALTER TABLE "Answer" ADD COLUMN     "attemptId" TEXT;

-- Backfill: each player's existing answers become one attempt, left unfinished
-- (the database can't know whether they covered every message; the app finishes it
-- once the remaining messages are answered).
INSERT INTO "Attempt" ("id", "playerId", "startedAt", "finishedAt")
SELECT gen_random_uuid()::text, "playerId", MIN("createdAt"), NULL
FROM "Answer"
GROUP BY "playerId";

UPDATE "Answer" a
SET "attemptId" = t."id"
FROM "Attempt" t
WHERE t."playerId" = a."playerId";

ALTER TABLE "Answer" ALTER COLUMN "attemptId" SET NOT NULL;

-- Only the first answer per message *within an attempt* counts.
DROP INDEX "Answer_playerId_messageId_key";
CREATE UNIQUE INDEX "Answer_attemptId_messageId_key" ON "Answer"("attemptId", "messageId");
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
