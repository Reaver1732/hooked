// Audit F84: an unfinished attempt is "playing now" only while it's recently active; one left
// behind is reported as not active, so the dashboard can call it an unfinished run.
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

test('inProgressActive follows the attempt’s last activity', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    assert.equal((await db.query('select current_database() as d')).rows[0].d, 'hooked_dev', 'only ever run against the dev database');
    const playerId = (await cls.join('Wanderer')).body.playerId as string;
    const { attemptId } = (await api.post(`/players/${playerId}/attempts`)).body;
    await api.post('/answers', { playerId, attemptId, messageId: messages[0].id, choice: 'phish' });
    const row = async () => (await api.get(`/classes/${cls.code}/summary`, cls.teacher)).body.players[0];

    assert.deepEqual([(await row()).inProgress, (await row()).inProgressActive], [1, true], 'just answered: playing now');

    // Ten minutes later with no answers: left behind.
    await db.query(`UPDATE "Attempt" SET "startedAt" = now() - interval '10 minutes' WHERE id = $1`, [attemptId]);
    await db.query(`UPDATE "Answer" SET "createdAt" = now() - interval '10 minutes' WHERE "attemptId" = $1`, [attemptId]);
    assert.deepEqual([(await row()).inProgress, (await row()).inProgressActive], [1, false], 'idle for 10 minutes: not active');

    // Coming back and answering again makes it active again.
    await api.post('/answers', { playerId, attemptId, messageId: messages[1].id, choice: 'phish' });
    assert.deepEqual([(await row()).inProgress, (await row()).inProgressActive], [2, true]);
  } finally {
    await db.end();
    await cls.remove();
  }
});
