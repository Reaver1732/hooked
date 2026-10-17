import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

let client: PrismaClient | null | undefined;

/**
 * The shared Prisma client, or null when DATABASE_URL isn't set: solo play needs no
 * database, so the server still starts and the class endpoints answer 503 instead.
 * Created on first use so a local .env has been loaded by then.
 */
export function getPrisma(): PrismaClient | null {
  if (client === undefined) {
    const connectionString = process.env.DATABASE_URL;
    client = connectionString ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) }) : null;
  }
  return client;
}
