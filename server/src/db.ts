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
