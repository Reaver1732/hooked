// Audit F48: an answer that's on its way when the student is removed gets the same 404 as a
// removed student, not a 500.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { messages } from '../shared/messages.ts';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('a student removed mid-answer gets 404', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    assert.equal((await db.query('select current_database() as d')).rows[0].d, 'hooked_dev', 'only ever run against the dev database');
    const playerId = (await cls.join('Leaving')).body.playerId as string;
    const { attemptId } = (await api.post(`/players/${playerId}/attempts`)).body;
    // Hold the player row so the answer's insert waits on its foreign-key check, then delete
    // the player under it.
    await db.query('BEGIN');
    await db.query('SELECT id FROM "Player" WHERE id = $1 FOR UPDATE', [playerId]);
    const answer = api.post('/answers', { playerId, attemptId, messageId: messages[0].id, choice: 'phish' });
    await new Promise((r) => setTimeout(r, 1500));
    await db.query('DELETE FROM "Player" WHERE id = $1', [playerId]);
    await db.query('COMMIT');
    const res = await answer;
    assert.equal(res.status, 404, JSON.stringify(res.body));
    assert.match(res.body.error, /removed/);
    assert.doesNotMatch(server.output(), /Error|at .*\.js/, 'no stack trace logged');
  } finally {
    await db.query('ROLLBACK').catch(() => {});
    await db.end();
    await cls.remove();
  }
});
