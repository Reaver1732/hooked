import { rateLimit, type AugmentedRequest } from 'express-rate-limit';

const MINUTE = 60 * 1000;

/**
 * Per-IP limiter (in memory, so per server instance). req.ip is the real client
 * address only because index.ts sets `trust proxy` to the two Railway proxy hops.
 */
function perIp(name: string, windowMs: number, limit: number, tooMany: string) {
  return rateLimit({
    windowMs,
    limit,
    identifier: name,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, _next, options) => {
      const resetTime = (req as AugmentedRequest).rateLimit?.resetTime;
      const minutes = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / MINUTE)) : null;
      const wait = minutes ? `Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` : 'Try again later.';
      console.warn(
        `rate limit "${name}" hit by ${req.ip} (x-forwarded-for: ${req.get('x-forwarded-for') ?? '-'}; x-real-ip: ${req.get('x-real-ip') ?? '-'})`,
      );
      res.status(options.statusCode).json({ error: `${tooMany} ${wait}` });
    },
  });
}

export const createClassLimit = perIp('create-class', 60 * MINUTE, 10, 'Too many classes created from your network.');
export const joinClassLimit = perIp('join-class', 10 * MINUTE, 30, 'Too many attempts to join a class from your network.');
export const answerLimit = perIp('answers', 10 * MINUTE, 300, 'Too many answers sent from your network.');
