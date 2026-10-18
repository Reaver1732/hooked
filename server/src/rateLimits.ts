import type { Response } from 'express';
import { rateLimit, type AugmentedRequest, type Options } from 'express-rate-limit';
import { CLASS_CODE_ALPHABET, CLASS_CODE_LENGTH, NICKNAME_MAX } from '../../shared/api.ts';

const MINUTE = 60 * 1000;

type LimiterOptions = {
  name: string;
  windowMs: number;
  limit: number;
  /** First sentence of the 429 message; how long to wait is appended. */
  tooMany: string;
  /** Defaults to the client IP (req.ip, correct because index.ts trusts Railway's proxies). */
  keyGenerator?: Options['keyGenerator'];
  /** Requests to leave out entirely: not counted and given no key in the store. */
  skip?: Options['skip'];
  /**
   * Count only requests the client got wrong (4xx), e.g. wrong rejoin codes. Server errors
   * (5xx, like a database outage) don't count, so an outage can't lock anyone out afterwards.
   */
  failuresOnly?: boolean;
  /** With failuresOnly: count only these statuses (e.g. wrong guesses, not malformed input). */
  countOnly?: number[];
  /** Count only requests that succeed, e.g. classes actually created. */
  successesOnly?: boolean;
};

/** In-memory limiter, so counts are per server instance. */
function limiter({ name, windowMs, limit, tooMany, keyGenerator, skip, failuresOnly = false, countOnly, successesOnly = false }: LimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    identifier: name,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: failuresOnly,
    skipFailedRequests: successesOnly,
    ...(failuresOnly && {
      requestWasSuccessful: (_req, res) =>
        countOnly ? !countOnly.includes(res.statusCode) : res.statusCode < 400 || res.statusCode >= 500,
    }),
    ...(keyGenerator && { keyGenerator }),
    ...(skip && { skip }),
    handler: (req, res, _next, options) => {
      const resetTime = (req as AugmentedRequest).rateLimit?.resetTime;
      const minutes = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / MINUTE)) : null;
      const wait = minutes ? `Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` : 'Try again later.';
      // No IPs, player ids or headers: we tell schools we keep nothing about students.
      console.warn(`rate limit "${name}" hit`);
      res.status(options.statusCode).json({ error: `${tooMany} ${wait}` });
    },
  });
}

// Per IP, but generous where a whole classroom or venue shares one address.
export const createClassLimit = limiter({
  name: 'create-class',
  windowMs: 60 * MINUTE,
  limit: 10,
  tooMany: 'Too many classes created from your network.',
  // Only classes actually created count: junk requests, errors during an outage, and the
  // 429s themselves can't block a school's teachers for an hour.
  successesOnly: true,
});
export const joinClassLimit = limiter({
  name: 'join-class',
  windowMs: 10 * MINUTE,
  limit: 300,
  tooMany: 'Too many attempts to join a class from your network.',
});
// Status checks (the start screen checks each saved class) get their own budget, so they
// can't use up a school network's joins.
export const classStatusLimit = limiter({
  name: 'class-status',
  windowMs: 10 * MINUTE,
  limit: 600,
  tooMany: 'Too many requests from your network.',
});

/**
 * Per player, so classmates on one network never share a budget. Must run after a
 * middleware that has verified the player exists and set res.locals.playerId.
 */
export const answerLimit = limiter({
  name: 'answers',
  windowMs: MINUTE,
  limit: 60,
  tooMany: 'You’re answering faster than anyone can read.',
  keyGenerator: (_req, res) => (res as Response).locals.playerId as string,
});

/**
 * The rejoin limiter's key for one student: the class code (trimmed and uppercased like the
 * route's codeSchema) and the nickname (folded with NFKC like new nicknames, then lowercased
 * the way nickname lookups compare). Used by the limiter and by the teacher's "Reset code".
 */
export const rejoinKey = (code: string, nickname: string) =>
  `${code.trim().toUpperCase()}:${nickname.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()}`;

const CLASS_CODE_SHAPE = new RegExp(`^[${CLASS_CODE_ALPHABET}]{${CLASS_CODE_LENGTH}}$`);

/**
 * The rejoin limiter's key for a request, or null when the request is malformed. Those get a
 * 400 that never counts anyway, and leaving them out keeps attacker-sized strings (a URL path
 * can be about 16 KB) out of the in-memory store.
 */
export function rejoinRequestKey(code: unknown, nickname: unknown): string | null {
  if (typeof code !== 'string' || typeof nickname !== 'string') return null;
  if (!CLASS_CODE_SHAPE.test(code.trim().toUpperCase())) return null;
  const key = rejoinKey(code, nickname);
  const normalizedNickname = key.slice(key.indexOf(':') + 1);
  return normalizedNickname && [...normalizedNickname].length <= NICKNAME_MAX ? key : null;
}

// Rejoin codes are 6 characters, so guessing is limited twice: per student (class code and
// nickname, from any number of IPs) and per IP (across classes). Only wrong guesses (401) and
// unknown classes (404) count: not correct rejoins, malformed requests, or the 429s themselves.
// So someone who can see the class code can't lock the whole class out, and a school network
// full of students with typos doesn't hit the per-IP limit. A ~887-million code space with 10
// guesses per student per 10 minutes keeps guessing hopeless.
export const rejoinClassLimit = limiter({
  name: 'rejoin-student',
  windowMs: 10 * MINUTE,
  limit: 10,
  tooMany: 'Too many wrong codes for this nickname. Ask your teacher for a new code, or try again later.',
  keyGenerator: (req) => rejoinRequestKey(req.params.code, req.body?.nickname) ?? '',
  skip: (req) => rejoinRequestKey(req.params.code, req.body?.nickname) === null,
  failuresOnly: true,
  countOnly: [401, 404],
});
export const rejoinIpLimit = limiter({
  name: 'rejoin-ip',
  windowMs: 10 * MINUTE,
  limit: 120,
  tooMany: 'Too many wrong rejoin codes from your network.',
  failuresOnly: true,
  countOnly: [401, 404],
});

/**
 * Dashboard summaries, per class. Runs after the teacher key is checked (res.locals.cls), so
 * someone without the key can't use up a teacher's budget. An open dashboard polls 12 a minute.
 */
export const summaryLimit = limiter({
  name: 'summary',
  windowMs: MINUTE,
  limit: 60,
  tooMany: 'The dashboard is refreshing too often.',
  keyGenerator: (_req, res) => (res as Response).locals.cls.id as string,
});

/**
 * Player progress lookups and attempt starts, per player, so classmates on one network never
 * share a budget and one device can't use it up for everyone. Must run after loadPlayer
 * (classes.ts), which checks the player exists and sets res.locals.playerId.
 */
export const playerLimit = limiter({
  name: 'player',
  windowMs: 10 * MINUTE,
  limit: 60,
  tooMany: 'Too many requests for this player.',
  keyGenerator: (_req, res) => (res as Response).locals.playerId as string,
});

/**
 * Requests for player ids that don't exist (progress, attempt starts, answers), per IP. Only
 * the not-found path calls this, so it can slow down made-up ids without ever blocking a real
 * player.
 */
export const unknownPlayerLimit = limiter({
  name: 'unknown-player',
  windowMs: 10 * MINUTE,
  limit: 100,
  tooMany: 'Too many requests from your network.',
});

/**
 * Counts failures per key in memory, for checks that only the failure path should consult: a
 * request that passes never touches it, so it can't be used to block legitimate users who
 * share a network with whoever is failing.
 */
function failureCounter({ name, windowMs, limit }: { name: string; windowMs: number; limit: number }) {
  const counts = new Map<string, { count: number; resetAt: number }>();
  return {
    /** Records a failure; true once this key is over the limit. */
    hit(key: string): boolean {
      const now = Date.now();
      if (counts.size > 10_000) {
        for (const [k, v] of counts) if (v.resetAt <= now) counts.delete(k);
      }
      let entry = counts.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        counts.set(key, entry);
      }
      entry.count++;
      if (entry.count === limit + 1) console.warn(`rate limit "${name}" hit`);
      return entry.count > limit;
    },
  };
}

/**
 * Failed teacher-key checks per IP (wrong key, or a class code that doesn't exist). Without a
 * cap, the 401-vs-404 answer would be an unlimited way to find which class codes exist. Only
 * failures are counted, so a teacher with the right key is never blocked, even when students
 * on the same school network are guessing.
 */
export const teacherKeyFailures = failureCounter({ name: 'teacher-key', windowMs: 10 * MINUTE, limit: 30 });
