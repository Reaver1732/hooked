import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  CLASS_CODE_ALPHABET,
  CLASS_CODE_LENGTH,
  CLASS_IDLE_DAYS,
  MAX_PLAYERS_PER_CLASS,
  NICKNAME_MAX,
  REJOIN_CODE_LENGTH,
  type AttemptProgress,
  type ClassSummary,
  type CreateClassResponse,
  type JoinClassResponse,
  type KeepClassResponse,
  type PlayerProgress,
  type RejoinResponse,
  type ResetRejoinCodeResponse,
  type Score,
  type SubmitAnswerResponse,
} from '../../shared/api.ts';
import { mostMissedFlags } from '../../shared/flags.ts';
import { messages, type Message } from '../../shared/messages.ts';
import { getPrisma } from './db.ts';
import { answerLimit, createClassLimit, joinClassLimit, playerLimit, rejoinClassLimit, rejoinIpLimit } from './rateLimits.ts';
import { Prisma, type PrismaClient } from './generated/prisma/client.ts';

const messagesById = new Map(messages.map((m) => [m.id, m]));
const MESSAGE_IDS = messages.map((m) => m.id);

// ---- Validation -------------------------------------------------------------------

const codeOfLength = (length: number, message: string) =>
  z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.string().regex(new RegExp(`^[${CLASS_CODE_ALPHABET}]{${length}}$`), message));

const codeSchema = codeOfLength(CLASS_CODE_LENGTH, 'Invalid class code');
const rejoinCodeSchema = codeOfLength(REJOIN_CODE_LENGTH, 'That rejoin code doesn’t look right. It’s 6 letters and numbers.');

// Control characters plus invisible/bidi-override characters that make names misleading.
const HIDDEN_CHARS = /[\p{Cc}​‌‎‏‪-‮⁦-⁩﻿]/u;

const nicknameSchema = z
  .string()
  .transform((s) => s.normalize('NFC').trim().replace(/\s+/g, ' '))
  .refine((s) => s.length > 0, 'Nickname is required')
  .refine((s) => [...s].length <= NICKNAME_MAX, `Nickname must be ${NICKNAME_MAX} characters or fewer`)
  .refine((s) => !HIDDEN_CHARS.test(s), 'Nickname contains characters that aren’t allowed');

// Strict objects reject unknown keys: students only ever send a nickname, a rejoin code,
// or an answer; teachers only a target score.
const joinBody = z.strictObject({ nickname: nicknameSchema });
const rejoinBody = z.strictObject({ nickname: nicknameSchema, rejoinCode: rejoinCodeSchema });
const answerBody = z.strictObject({
  playerId: z.uuid(),
  attemptId: z.uuid(),
  messageId: z.string().max(100),
  choice: z.enum(['phish', 'legit']),
});
const updateClassBody = z.strictObject({ targetPercent: z.number().int().min(1).max(100) });
const emptyBody = z.strictObject({});
const teacherKeySchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? 'Invalid request');
  return result.data;
}

function db(): PrismaClient {
  const prisma = getPrisma();
  if (!prisma) throw new HttpError(503, 'Classes aren’t available on this server (no database configured).');
  return prisma;
}

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

// ---- Secrets ----------------------------------------------------------------------

function newCode(length: number): string {
  return Array.from({ length }, () => CLASS_CODE_ALPHABET[randomInt(CLASS_CODE_ALPHABET.length)]).join('');
}

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');
/** Salted with the player id so equal codes never produce equal hashes. */
const hashRejoinCode = (playerId: string, code: string) => hashKey(`${playerId}:${code}`);

function hashesEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Loads the class for :code and checks the X-Teacher-Key header against its stored hash. */
async function requireTeacher(req: Request) {
  const code = parse(codeSchema, req.params.code);
  const key = teacherKeySchema.safeParse(req.get('X-Teacher-Key'));
  if (!key.success) throw new HttpError(401, 'Missing or invalid teacher key');

  const cls = await findActiveClass(code);
  if (!cls) throw new HttpError(404, 'This class was closed or has expired.');
  if (!hashesEqual(hashKey(key.data), cls.teacherKeyHash)) throw new HttpError(401, 'Missing or invalid teacher key');
  return cls;
}

// ---- Routes -----------------------------------------------------------------------

export const classesRouter = Router();

classesRouter.post('/classes', createClassLimit, async (req, res) => {
  parse(emptyBody, req.body ?? {});
  const teacherKey = randomBytes(32).toString('base64url');
  // Codes are random; retry on the rare collision with an existing class.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const cls = await db().class.create({ data: { code: newCode(CLASS_CODE_LENGTH), teacherKeyHash: hashKey(teacherKey) } });
      res.status(201).json({ code: cls.code, teacherKey } satisfies CreateClassResponse);
      return;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new HttpError(503, 'Couldn’t create a class code, try again');
});

classesRouter.post('/classes/:code/join', joinClassLimit, async (req, res) => {
  const code = parse(codeSchema, req.params.code);
  const { nickname } = parse(joinBody, req.body);

  const cls = await findActiveClass(code);
  if (!cls) throw new HttpError(404, 'No class with that code');

  const taken = await db().player.findFirst({
    where: { classId: cls.id, nickname: { equals: nickname, mode: 'insensitive' } },
  });
  if (taken) throw new HttpError(409, 'Someone in this class already has that nickname');

  // Take a seat and add the player in one statement. Concurrent joins queue on the
  // Class row lock and re-check "playerCount" < cap against the latest value, so the
  // cap holds without a long-running transaction (a whole class may join at once).
  const playerId = randomUUID();
  const rejoinCode = newCode(REJOIN_CODE_LENGTH);
  const inserted = await db().$queryRaw<{ id: string }[]>`
    WITH seat AS (
      UPDATE "Class" SET "playerCount" = "playerCount" + 1, "lastActivityAt" = now() AT TIME ZONE 'UTC'
      WHERE id = ${cls.id} AND "playerCount" < ${MAX_PLAYERS_PER_CLASS}
      RETURNING id
    )
    INSERT INTO "Player" (id, "classId", nickname, "rejoinCodeHash")
    SELECT ${playerId}, seat.id, ${nickname}, ${hashRejoinCode(playerId, rejoinCode)} FROM seat
    RETURNING id`;
  if (inserted.length === 0) {
    throw new HttpError(409, `This class is full (${MAX_PLAYERS_PER_CLASS} players). Ask your teacher to start another class.`);
  }
  // The rejoin code is shown to the student once, here; only its hash is kept.
  res.status(201).json({ playerId, nickname, rejoinCode } satisfies JoinClassResponse);
});

/** Restores a player on another device: class code + nickname + rejoin code. */
classesRouter.post('/classes/:code/rejoin', rejoinIpLimit, rejoinClassLimit, async (req, res) => {
  const code = parse(codeSchema, req.params.code);
  const { nickname, rejoinCode } = parse(rejoinBody, req.body);
  const cls = await findActiveClass(code);
  if (!cls) throw new HttpError(404, 'No class with that code');
  const player = await db().player.findFirst({
    where: { classId: cls.id, nickname: { equals: nickname, mode: 'insensitive' } },
  });
  // Same answer for an unknown nickname and a wrong code, so neither can be probed.
  if (!player?.rejoinCodeHash || !hashesEqual(hashRejoinCode(player.id, rejoinCode), player.rejoinCodeHash)) {
    throw new HttpError(401, 'That nickname and rejoin code don’t match. Check both, or ask your teacher for a new code.');
  }
  await touchClass(cls.id, { throttleMs: 60_000 });
  res.json({ playerId: player.id, nickname: player.nickname } satisfies RejoinResponse);
});

const attemptAnswers = { select: { messageId: true, choice: true }, orderBy: { createdAt: 'asc' } } as const;

const toProgress = (a: { id: string; answers: { messageId: string; choice: 'phish' | 'legit' }[] }): AttemptProgress => ({
  attemptId: a.id,
  answers: a.answers.map(({ messageId, choice }) => ({ messageId, choice })),
});

/** A player's own progress. Knowing the (random) player id is what scopes it. */
classesRouter.get('/players/:playerId', playerLimit, async (req, res) => {
  const playerId = parse(z.uuid(), req.params.playerId);
  const player = await db().player.findFirst({
    where: { id: playerId, class: { lastActivityAt: { gte: idleCutoff() } } },
    include: {
      class: { select: { code: true } },
      attempts: { orderBy: { startedAt: 'desc' }, include: { answers: attemptAnswers } },
    },
  });
  if (!player) throw new HttpError(404, 'Player not found. You may have been removed, or the class was closed.');
  const current = player.attempts.find((a) => !a.finishedAt);
  res.set('Cache-Control', 'no-store').json({
    playerId: player.id,
    nickname: player.nickname,
    classCode: player.class.code,
    currentAttempt: current ? toProgress(current) : null,
    finishedAttempts: player.attempts.filter((a) => a.finishedAt).length,
  } satisfies PlayerProgress);
});

/** Resumes the player's unfinished attempt, or starts a new one. */
classesRouter.post('/players/:playerId/attempts', playerLimit, async (req, res) => {
  const playerId = parse(z.uuid(), req.params.playerId);
  parse(emptyBody, req.body ?? {});
  const attempt = await db().$transaction(async (tx) => {
    // Lock the player so two quick calls can't both create an attempt.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT p.id FROM "Player" p JOIN "Class" c ON c.id = p."classId"
      WHERE p.id = ${playerId} AND c."lastActivityAt" >= ${idleCutoff()}
      FOR UPDATE OF p`;
    if (locked.length === 0) return null;
    const open = await tx.attempt.findFirst({
      where: { playerId, finishedAt: null },
      orderBy: { startedAt: 'desc' },
      include: { answers: attemptAnswers },
    });
    return open ?? tx.attempt.create({ data: { playerId }, include: { answers: attemptAnswers } });
  });
  if (!attempt) throw new HttpError(404, 'Player not found. You may have been removed, or the class was closed.');
  res.json(toProgress(attempt) satisfies AttemptProgress);
});

type ValidAnswer = z.infer<typeof answerBody> & { message: Message };

/**
 * Validates an answer and checks its player exists before the per-player rate limit
 * runs, so made-up player ids are rejected without being counted.
 */
async function validateAnswer(req: Request, res: Response, next: NextFunction) {
  const body = parse(answerBody, req.body);
  const message = messagesById.get(body.messageId);
  if (!message) throw new HttpError(400, 'Unknown message');
  const player = await db().player.findFirst({
    where: { id: body.playerId, class: { lastActivityAt: { gte: idleCutoff() } } },
    select: { id: true, classId: true, attempts: { where: { id: body.attemptId }, select: { finishedAt: true } } },
  });
  if (!player) throw new HttpError(404, 'Player not found. You may have been removed from the class.');
  const attempt = player.attempts[0];
  if (!attempt) throw new HttpError(409, 'That attempt doesn’t belong to you. Go back to the start to keep playing.');
  if (attempt.finishedAt) throw new HttpError(409, 'That attempt is already finished. Press Play again to start a new one.');
  res.locals.playerId = player.id;
  res.locals.classId = player.classId;
  res.locals.answer = { ...body, message } satisfies ValidAnswer;
  next();
}

classesRouter.post('/answers', validateAnswer, answerLimit, async (_req, res) => {
  const { playerId, attemptId, messageId, choice, message } = res.locals.answer as ValidAnswer;

  // Graded here from shared data; the client never tells us what's correct.
  const correct = (choice === 'phish') === message.isPhish;
  await touchClass(res.locals.classId as string, { throttleMs: 60_000 });
  let result: { correct: boolean; alreadyAnswered: boolean };
  try {
    await db().answer.create({ data: { playerId, attemptId, messageId, choice, correct } });
    result = { correct, alreadyAnswered: false };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // First answer per message within an attempt counts; report how it was graded.
    const existing = await db().answer.findUniqueOrThrow({ where: { attemptId_messageId: { attemptId, messageId } } });
    result = { correct: existing.correct, alreadyAnswered: true };
  }
  // The attempt is finished once every message in the current set has an answer.
  const answered = await db().answer.count({ where: { attemptId, messageId: { in: MESSAGE_IDS } } });
  const attemptFinished = answered >= MESSAGE_IDS.length;
  if (attemptFinished) {
    await db().attempt.updateMany({ where: { id: attemptId, finishedAt: null }, data: { finishedAt: new Date() } });
  }
  res.status(result.alreadyAnswered ? 200 : 201).json({ ...result, attemptFinished } satisfies SubmitAnswerResponse);
});

type GradedAnswer = { messageId: string; choice: 'phish' | 'legit'; correct: boolean };

/** Score over answers to messages that still exist. */
function scoreOf(answers: GradedAnswer[]): Score {
  const known = answers.filter((a) => messagesById.has(a.messageId));
  const correct = known.filter((a) => a.correct).length;
  return { correct, total: known.length, percent: known.length ? Math.round((correct / known.length) * 100) : 0 };
}

/** Best finished attempt: highest percentage, then most correct; ties keep the earliest. */
function bestAttempt<T extends { finishedAt: Date | null; answers: GradedAnswer[] }>(attempts: T[]) {
  let best: { attempt: T; score: Score } | null = null;
  for (const attempt of attempts) {
    if (!attempt.finishedAt) continue;
    const score = scoreOf(attempt.answers);
    const ratio = score.total ? score.correct / score.total : 0;
    const bestRatio = best && best.score.total ? best.score.correct / best.score.total : -1;
    if (!best || ratio > bestRatio || (ratio === bestRatio && score.correct > best.score.correct)) best = { attempt, score };
  }
  return best;
}

classesRouter.get('/classes/:code/summary', async (req, res) => {
  const cls = await requireTeacher(req);
  const players = await db().player.findMany({
    where: { classId: cls.id },
    orderBy: { createdAt: 'asc' },
    include: {
      attempts: {
        orderBy: { startedAt: 'asc' },
        include: { answers: { select: { messageId: true, choice: true, correct: true } } },
      },
    },
  });

  const target = cls.targetPercent;
  const rows = players.map((p) => {
    const best = bestAttempt(p.attempts);
    const current = p.attempts.find((a) => !a.finishedAt);
    return {
      best,
      row: {
        id: p.id,
        nickname: p.nickname,
        attempts: p.attempts.filter((a) => a.finishedAt).length,
        inProgress: current ? current.answers.length : null,
        best: best?.score ?? null,
        // Exact comparison (12/15 = 80% passes an 80% target), not the rounded percent.
        passed: best ? best.score.total > 0 && best.score.correct * 100 >= target * best.score.total : false,
      },
    };
  });

  // Most-missed flags and per-message results use each student's best attempt.
  const bestAnswers = rows.flatMap((r) => r.best?.attempt.answers ?? []);
  const graded = bestAnswers.flatMap((a) => {
    const message = messagesById.get(a.messageId);
    return message ? [{ message, guessedPhish: a.choice === 'phish' }] : [];
  });
  const bestScores = rows.flatMap((r) => (r.best ? [r.best.score] : []));

  const summary: ClassSummary = {
    code: cls.code,
    expiresAt: expiresAt(cls.lastActivityAt),
    targetPercent: target,
    playerCount: players.length,
    totalMessages: messages.length,
    averageBestPercent: bestScores.length
      ? Math.round(bestScores.reduce((sum, s) => sum + s.percent, 0) / bestScores.length)
      : null,
    passedCount: rows.filter((r) => r.row.passed).length,
    players: rows.map((r) => r.row),
    mostMissedFlags: mostMissedFlags(graded).map(([type, count]) => ({ type, count })),
    perMessage: messages.map((m) => {
      const answers = bestAnswers.filter((a) => a.messageId === m.id);
      const correctCount = answers.filter((a) => a.correct).length;
      return {
        id: m.id,
        kind: m.kind,
        label: messageLabel(m),
        isPhish: m.isPhish,
        answered: answers.length,
        percentCorrect: answers.length ? Math.round((correctCount / answers.length) * 100) : null,
      };
    }),
  };
  res.set('Cache-Control', 'no-store').json(summary);
});

/** Teacher: change the class's target score. */
classesRouter.patch('/classes/:code', async (req, res) => {
  const cls = await requireTeacher(req);
  const { targetPercent } = parse(updateClassBody, req.body);
  await db().class.update({ where: { id: cls.id }, data: { targetPercent } });
  res.json({ targetPercent });
});

/** Teacher: give a student a new rejoin code (shown to the teacher once). */
classesRouter.post('/classes/:code/players/:playerId/rejoin-code', async (req, res) => {
  const cls = await requireTeacher(req);
  const playerId = parse(z.uuid(), req.params.playerId);
  const rejoinCode = newCode(REJOIN_CODE_LENGTH);
  const { count } = await db().player.updateMany({
    where: { id: playerId, classId: cls.id },
    data: { rejoinCodeHash: hashRejoinCode(playerId, rejoinCode) },
  });
  if (count === 0) throw new HttpError(404, 'Player not found in this class');
  res.json({ rejoinCode } satisfies ResetRejoinCodeResponse);
});

classesRouter.delete('/classes/:code/players/:playerId', async (req, res) => {
  const cls = await requireTeacher(req);
  const playerId = parse(z.uuid(), req.params.playerId);
  // Delete the player (answers cascade) and free their seat in one statement.
  const removed = await db().$queryRaw<{ id: string }[]>`
    WITH gone AS (
      DELETE FROM "Player" WHERE id = ${playerId} AND "classId" = ${cls.id} RETURNING "classId"
    )
    UPDATE "Class" SET "playerCount" = "playerCount" - 1
    WHERE id IN (SELECT "classId" FROM gone)
    RETURNING id`;
  if (removed.length === 0) throw new HttpError(404, 'Player not found in this class');
  res.status(204).end();
});

/** Public: lets a student's app tell "class closed" apart from "you were removed". */
classesRouter.get('/classes/:code/status', joinClassLimit, async (req, res) => {
  const code = parse(codeSchema, req.params.code);
  if (!(await findActiveClass(code))) throw new HttpError(404, 'This class was closed.');
  res.set('Cache-Control', 'no-store').json({ open: true });
});

/** Teacher: dashboard opened (first load only) or "Keep this class" pressed. */
classesRouter.post('/classes/:code/keep', async (req, res) => {
  const cls = await requireTeacher(req);
  const updated = await touchClass(cls.id);
  res.json({ expiresAt: expiresAt(updated ?? cls.lastActivityAt) } satisfies KeepClassResponse);
});

/** Teacher: delete the class; players and answers cascade. */
classesRouter.delete('/classes/:code', async (req, res) => {
  const cls = await requireTeacher(req);
  await db().class.deleteMany({ where: { id: cls.id } });
  res.status(204).end();
});

// ---- Expiry -----------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Classes last active before this are expired (and deleted by the next cleanup run). */
export const idleCutoff = () => new Date(Date.now() - CLASS_IDLE_DAYS * DAY_MS);

const expiresAt = (lastActivityAt: Date) => new Date(lastActivityAt.getTime() + CLASS_IDLE_DAYS * DAY_MS).toISOString();

/** A class by code, unless it has expired; cleanup runs hourly, so check here too. */
function findActiveClass(code: string) {
  return db().class.findFirst({ where: { code, lastActivityAt: { gte: idleCutoff() } } });
}

/**
 * Marks a class active now. With throttleMs, skips the write if it was marked within
 * that window (answers arrive in bursts; one write a minute is plenty). Returns the new
 * time, or null if skipped.
 */
async function touchClass(classId: string, { throttleMs = 0 } = {}): Promise<Date | null> {
  const now = new Date();
  const { count } = await db().class.updateMany({
    where: { id: classId, ...(throttleMs && { lastActivityAt: { lt: new Date(now.getTime() - throttleMs) } }) },
    data: { lastActivityAt: now },
  });
  return count ? now : null;
}

function messageLabel(m: Message): string {
  if (m.kind === 'email' && m.subject) return m.subject;
  const firstLine = m.body.split('\n')[0].replace(/\{\{\d+\}\}/g, '…');
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
}

// ---- Errors -----------------------------------------------------------------------

/** JSON errors for /api. Client errors keep their message; anything else is a generic 500. */
export function apiErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // body-parser errors (malformed JSON, body too large) carry a 4xx status.
  const status = (err as { status?: unknown }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: status === 413 ? 'Request body too large' : 'Malformed request body' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
}
