import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

let client: PrismaClient | null | undefined;

/**
 * Bounds on every database call, so a slow or unreachable database fails requests in seconds
 * instead of hanging them, and the pool recovers on its own when it comes back:
 * - connectionTimeoutMillis: connecting, and waiting for a free pool slot;
 * - statement_timeout: Postgres cancels a slow query (or a long lock wait) itself, first;
 * - query_timeout: the client gives up if Postgres doesn't answer at all;
 * - keepAlive: half-open sockets are noticed in seconds, not the OS default of 2 hours.
 */
const POOL_OPTIONS = {
  connectionTimeoutMillis: 10_000,
  statement_timeout: 8_000,
  query_timeout: 10_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
};

/**
 * The shared Prisma client, or null when DATABASE_URL isn't set: solo play needs no
 * database, so the server still starts and the class endpoints answer 503 instead.
 * Created on first use so a local .env has been loaded by then.
 */
export function getPrisma(): PrismaClient | null {
  if (client === undefined) {
    const connectionString = process.env.DATABASE_URL;
    client = connectionString ? new PrismaClient({ adapter: new PrismaPg({ connectionString, ...POOL_OPTIONS }) }) : null;
  }
  return client;
}

export type DatabaseHealth = 'ok' | 'down' | 'unconfigured' | 'checking';
const HEALTH_TTL_MS = 30_000;
let health: { state: DatabaseHealth; checkedAt: number } = { state: 'checking', checkedAt: 0 };
let healthCheck: Promise<void> | null = null;

/**
 * Whether class mode can reach its database, for /api/health. Never waits on the database: it
 * returns the last result and refreshes it in the background at most every 30 seconds, so a
 * health poller can't slow down or load a struggling database.
 */
export function databaseHealth(): DatabaseHealth {
  const prisma = getPrisma();
  if (!prisma) return 'unconfigured';
  if (!healthCheck && Date.now() - health.checkedAt >= HEALTH_TTL_MS) {
    healthCheck = prisma.$queryRaw`SELECT 1`
      .then(
        () => 'ok' as const,
        () => 'down' as const,
      )
      .then((state) => {
        health = { state, checkedAt: Date.now() };
        healthCheck = null;
      });
  }
  return health.state;
}

// Prisma codes for "can't reach the database" (P1001 unreachable, P1002 timed out, P1008
// operation timed out, P1017 server closed the connection, P2037 too many connections).
const DATABASE_DOWN_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2037']);
// The pg driver's own timeouts and socket errors, which reach us without a Prisma wrapper.
const DATABASE_DOWN_MESSAGE = /connection timeout|Connection terminated|Query read timeout|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH/i;

/**
 * A short description if this error means the database is unreachable (rather than a bug),
 * or null. Used to answer 503 instead of 500 and to log one line instead of a stack.
 */
export function databaseDownReason(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && DATABASE_DOWN_CODES.has(code)) return code;
  if (err.name === 'PrismaClientInitializationError') return 'init';
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (DATABASE_DOWN_MESSAGE.test(e.message)) return e.message.slice(0, 80);
  }
  return null;
}
