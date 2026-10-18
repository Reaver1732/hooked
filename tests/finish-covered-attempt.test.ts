// Audit F26: an attempt that has every message answered but was never marked finished is
// finished (and counts) the next time the player starts, instead of being resumed forever.
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

test('a fully answered but unfinished attempt is finished on the next start', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    assert.equal((await db.query('select current_database() as d')).rows[0].d, 'hooked_dev', 'only ever run against the dev database');
    const playerId = (await cls.join('Stuck')).body.playerId as string;
    const { attemptId } = (await api.post(`/players/${playerId}/attempts`)).body;
    for (const m of messages) {
      await api.post('/answers', { playerId, attemptId, messageId: m.id, choice: m.isPhish ? 'phish' : 'legit' });
    }
    // Simulate the "mark finished" step failing after the last answer was saved.
    await db.query('UPDATE "Attempt" SET "finishedAt" = NULL WHERE id = $1', [attemptId]);

    const next = await api.post(`/players/${playerId}/attempts`);
    assert.equal(next.status, 200);
    assert.notEqual(next.body.attemptId, attemptId, 'a new attempt starts');
    assert.deepEqual(next.body.answers, []);
    const progress = await api.get(`/players/${playerId}`);
    assert.equal(progress.body.finishedAttempts, 1, 'the stuck attempt now counts');
    const summary = await api.get(`/classes/${cls.code}/summary`, cls.teacher);
    assert.equal(summary.body.players[0].best.total, messages.length);
  } finally {
    await db.end();
    await cls.remove();
  }
});
