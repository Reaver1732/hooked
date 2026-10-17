import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  CLASS_CODE_ALPHABET,
  CLASS_CODE_LENGTH,
  NICKNAME_MAX,
  type ClassSummary,
  type CreateClassResponse,
  type JoinClassResponse,
  type SubmitAnswerResponse,
} from '../../shared/api.ts';
import { mostMissedFlags } from '../../shared/flags.ts';
import { messages, type Message } from '../../shared/messages.ts';
import { getPrisma } from './db.ts';
import { Prisma, type PrismaClient } from './generated/prisma/client.ts';

const messagesById = new Map(messages.map((m) => [m.id, m]));

// ---- Validation -------------------------------------------------------------------

const codeSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().regex(new RegExp(`^[${CLASS_CODE_ALPHABET}]{${CLASS_CODE_LENGTH}}$`), 'Invalid class code'));

// Control characters plus invisible/bidi-override characters that make names misleading.
const HIDDEN_CHARS = /[\p{Cc}​‌‎‏‪-‮⁦-⁩﻿]/u;

const nicknameSchema = z
  .string()
  .transform((s) => s.normalize('NFC').trim().replace(/\s+/g, ' '))
  .refine((s) => s.length > 0, 'Nickname is required')
  .refine((s) => [...s].length <= NICKNAME_MAX, `Nickname must be ${NICKNAME_MAX} characters or fewer`)
  .refine((s) => !HIDDEN_CHARS.test(s), 'Nickname contains characters that aren’t allowed');

// Strict objects reject unknown keys: nothing but a nickname or an answer is accepted.
const joinBody = z.strictObject({ nickname: nicknameSchema });
const answerBody = z.strictObject({
  playerId: z.uuid(),
  messageId: z.string().max(100),
  choice: z.enum(['phish', 'legit']),
});
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

function newClassCode(): string {
  return Array.from({ length: CLASS_CODE_LENGTH }, () => CLASS_CODE_ALPHABET[randomInt(CLASS_CODE_ALPHABET.length)]).join('');
}

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

/** Loads the class for :code and checks the X-Teacher-Key header against its stored hash. */
async function requireTeacher(req: Request) {
  const code = parse(codeSchema, req.params.code);
  const key = teacherKeySchema.safeParse(req.get('X-Teacher-Key'));
  if (!key.success) throw new HttpError(401, 'Missing or invalid teacher key');

  const cls = await db().class.findUnique({ where: { code } });
  if (!cls) throw new HttpError(404, 'Class not found');
  const given = Buffer.from(hashKey(key.data), 'hex');
  const stored = Buffer.from(cls.teacherKeyHash, 'hex');
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
    throw new HttpError(401, 'Missing or invalid teacher key');
  }
  return cls;
}

// ---- Routes -----------------------------------------------------------------------

export const classesRouter = Router();

classesRouter.post('/classes', async (req, res) => {
  parse(emptyBody, req.body ?? {});
  const teacherKey = randomBytes(32).toString('base64url');
  // Codes are random; retry on the rare collision with an existing class.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const cls = await db().class.create({ data: { code: newClassCode(), teacherKeyHash: hashKey(teacherKey) } });
      res.status(201).json({ code: cls.code, teacherKey } satisfies CreateClassResponse);
      return;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new HttpError(503, 'Couldn’t create a class code, try again');
});

classesRouter.post('/classes/:code/join', async (req, res) => {
  const code = parse(codeSchema, req.params.code);
  const { nickname } = parse(joinBody, req.body);

  const cls = await db().class.findUnique({ where: { code } });
  if (!cls) throw new HttpError(404, 'No class with that code');
  const taken = await db().player.findFirst({
    where: { classId: cls.id, nickname: { equals: nickname, mode: 'insensitive' } },
  });
  if (taken) throw new HttpError(409, 'Someone in this class already has that nickname');

  const player = await db().player.create({ data: { classId: cls.id, nickname } });
  res.status(201).json({ playerId: player.id } satisfies JoinClassResponse);
});

classesRouter.post('/answers', async (req, res) => {
  const { playerId, messageId, choice } = parse(answerBody, req.body);
  const message = messagesById.get(messageId);
  if (!message) throw new HttpError(400, 'Unknown message');

  const player = await db().player.findUnique({ where: { id: playerId } });
  if (!player) throw new HttpError(404, 'Player not found. You may have been removed from the class.');

  // Graded here from shared data; the client never tells us what's correct.
  const correct = (choice === 'phish') === message.isPhish;
  try {
    await db().answer.create({ data: { playerId, messageId, choice, correct } });
    res.status(201).json({ correct, alreadyAnswered: false } satisfies SubmitAnswerResponse);
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // First answer counts; report how it was graded.
    const existing = await db().answer.findUniqueOrThrow({ where: { playerId_messageId: { playerId, messageId } } });
    res.json({ correct: existing.correct, alreadyAnswered: true } satisfies SubmitAnswerResponse);
  }
});

classesRouter.get('/classes/:code/summary', async (req, res) => {
  const cls = await requireTeacher(req);
  const players = await db().player.findMany({
    where: { classId: cls.id },
    orderBy: { createdAt: 'asc' },
    include: { answers: { select: { messageId: true, choice: true, correct: true } } },
  });

  const allAnswers = players.flatMap((p) => p.answers);
  const active = players.filter((p) => p.answers.length > 0);
  const correctOf = (answers: { correct: boolean }[]) => answers.filter((a) => a.correct).length;

  const graded = allAnswers.flatMap((a) => {
    const message = messagesById.get(a.messageId);
    return message ? [{ message, guessedPhish: a.choice === 'phish' }] : [];
  });

  const summary: ClassSummary = {
    code: cls.code,
    playerCount: players.length,
    totalMessages: messages.length,
    averageCorrect: active.length
      ? active.reduce((sum, p) => sum + correctOf(p.answers), 0) / active.length
      : null,
    players: players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      answered: p.answers.length,
      correct: correctOf(p.answers),
    })),
    mostMissedFlags: mostMissedFlags(graded).map(([type, count]) => ({ type, count })),
    perMessage: messages.map((m) => {
      const answers = allAnswers.filter((a) => a.messageId === m.id);
      return {
        id: m.id,
        kind: m.kind,
        label: messageLabel(m),
        isPhish: m.isPhish,
        answered: answers.length,
        percentCorrect: answers.length ? Math.round((correctOf(answers) / answers.length) * 100) : null,
      };
    }),
  };
  res.set('Cache-Control', 'no-store').json(summary);
});

classesRouter.delete('/classes/:code/players/:playerId', async (req, res) => {
  const cls = await requireTeacher(req);
  const playerId = parse(z.uuid(), req.params.playerId);
  const { count } = await db().player.deleteMany({ where: { id: playerId, classId: cls.id } });
  if (count === 0) throw new HttpError(404, 'Player not found in this class');
  res.status(204).end();
});

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
