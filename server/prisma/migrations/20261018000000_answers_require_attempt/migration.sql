-- Reconciles production after 20261017235259 was briefly relaxed so the previous app
-- version could keep saving answers (it doesn't know about attempts). On a database
-- built from migrations, every statement here is a no-op.

-- Answers saved without an attempt join that player's open attempt, creating one if needed.
INSERT INTO "Attempt" ("id", "playerId", "startedAt", "finishedAt")
SELECT gen_random_uuid()::text, a."playerId", MIN(a."createdAt"), NULL
FROM "Answer" a
WHERE a."attemptId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Attempt" t WHERE t."playerId" = a."playerId" AND t."finishedAt" IS NULL)
GROUP BY a."playerId";

UPDATE "Answer" a
SET "attemptId" = (
  SELECT t."id" FROM "Attempt" t
  WHERE t."playerId" = a."playerId" AND t."finishedAt" IS NULL
  ORDER BY t."startedAt" DESC
  LIMIT 1
)
WHERE a."attemptId" IS NULL;

ALTER TABLE "Answer" ALTER COLUMN "attemptId" SET NOT NULL;

-- The old one-answer-per-player rule; answers are unique per attempt now.
DROP INDEX IF EXISTS "Answer_playerId_messageId_key";
