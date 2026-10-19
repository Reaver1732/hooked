// Audit F20 (the part that doesn't delete data): a player's progress reports the open attempt
// and a count of finished ones, loading only what it needs.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { messages } from '../shared/messages.ts';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('progress counts finished attempts and returns the open one', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  try {
    const playerId = (await cls.join('Replayer')).body.playerId as string;
    const playAttempt = async (count: number) => {
      const { attemptId } = (await api.post(`/players/${playerId}/attempts`)).body;
      for (const m of messages.slice(0, count)) {
        const res = await api.post('/answers', { playerId, attemptId, messageId: m.id, choice: m.isPhish ? 'phish' : 'legit' });
        assert.ok(res.status === 201, `answer accepted (${res.status})`);
      }
    };
    await playAttempt(messages.length);
    await playAttempt(messages.length);
    await playAttempt(3);
    const progress = await api.get(`/players/${playerId}`);
    assert.equal(progress.status, 200);
    assert.equal(progress.body.finishedAttempts, 2);
    assert.deepEqual(
      progress.body.currentAttempt.answers.map((a: { messageId: string }) => a.messageId),
      messages.slice(0, 3).map((m) => m.id),
    );
  } finally {
    await cls.remove();
  }
});
