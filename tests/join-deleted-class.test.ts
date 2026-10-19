// Audit F47: joining a class that's deleted while the join is on its way says the class was
// closed, not that it's full.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('a join that loses its class mid-request gets 404, not "full"', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    assert.equal((await db.query('select current_database() as d')).rows[0].d, 'hooked_dev', 'only ever run against the dev database');
    // Hold the class row so the join waits at its seat update, then delete the class under it.
    await db.query('BEGIN');
    await db.query('SELECT id FROM "Class" WHERE code = $1 FOR UPDATE', [cls.code]);
    const join = cls.join('Late');
    await new Promise((r) => setTimeout(r, 1500));
    await db.query('DELETE FROM "Class" WHERE code = $1', [cls.code]);
    await db.query('COMMIT');
    const res = await join;
    assert.equal(res.status, 404, JSON.stringify(res.body));
    assert.match(res.body.error, /closed/);
  } finally {
    await db.query('ROLLBACK').catch(() => {});
    await db.end();
    await cls.remove();
  }
});
