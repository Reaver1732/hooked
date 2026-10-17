import { defineConfig } from 'prisma/config';
import { loadLocalEnv } from './src/env.ts';

loadLocalEnv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` doesn't need a database, so don't fail when DATABASE_URL is unset
  // (e.g. at build time). migrate commands will report a missing URL themselves.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
