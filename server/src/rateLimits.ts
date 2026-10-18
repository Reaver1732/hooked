import type { Response } from 'express';
import { rateLimit, type AugmentedRequest, type Options } from 'express-rate-limit';

const MINUTE = 60 * 1000;

type LimiterOptions = {
  name: string;
  windowMs: number;
  limit: number;
  /** First sentence of the 429 message; how long to wait is appended. */
  tooMany: string;
  /** Defaults to the client IP (req.ip, correct because index.ts trusts Railway's proxies). */
  keyGenerator?: Options['keyGenerator'];
  /** Count only requests that fail (4xx/5xx), e.g. wrong rejoin codes. */
  failuresOnly?: boolean;
};

/** In-memory limiter, so counts are per server instance. */
function limiter({ name, windowMs, limit, tooMany, keyGenerator, failuresOnly = false }: LimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    identifier: name,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: failuresOnly,
    ...(keyGenerator && { keyGenerator }),
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
});
export const joinClassLimit = limiter({
  name: 'join-class',
  windowMs: 10 * MINUTE,
  limit: 300,
  tooMany: 'Too many attempts to join a class from your network.',
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

// Rejoin codes are 6 characters, so guessing is limited twice: per class (from any
// number of IPs) and per IP (across classes). Only wrong guesses count, so a class
// rejoining together from one school network never hits either limit.
export const rejoinClassLimit = limiter({
  name: 'rejoin-class',
  windowMs: 10 * MINUTE,
  limit: 30,
  tooMany: 'Too many wrong rejoin codes for this class.',
  // Same trim + uppercase as the route's codeSchema, so padded variants of a code share a bucket.
  keyGenerator: (req) => String(req.params.code ?? '').trim().toUpperCase(),
  failuresOnly: true,
});
export const rejoinIpLimit = limiter({
  name: 'rejoin-ip',
  windowMs: 10 * MINUTE,
  limit: 30,
  tooMany: 'Too many wrong rejoin codes from your network.',
  failuresOnly: true,
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
 * Lookups of player ids that don't exist, per IP. loadPlayer only calls this on the
 * not-found path, so it can slow down made-up ids without ever blocking a real player.
 */
export const unknownPlayerLimit = limiter({
  name: 'unknown-player',
  windowMs: 10 * MINUTE,
  limit: 100,
  tooMany: 'Too many requests from your network.',
});
