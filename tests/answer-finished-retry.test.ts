// Audit F51: resending an answer that already landed in a finished round returns its original
// grading (200, alreadyAnswered), not a 409 "already finished" error.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { messages } from '../shared/messages.ts';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('a retry on a finished round gets the original grading', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  try {
    const playerId = (await cls.join('Retry')).body.playerId as string;
    const { attemptId } = (await api.post(`/players/${playerId}/attempts`)).body;
    let last;
    for (const m of messages) {
      // Answer the last one wrong, to check the grading that comes back is the stored one.
      const wrong = m === messages.at(-1);
      const choice = m.isPhish !== wrong ? 'phish' : 'legit';
      last = { playerId, attemptId, messageId: m.id, choice };
      const res = await api.post('/answers', last);
      assert.equal(res.status, 201);
    }
    const retry = await api.post('/answers', { ...last, choice: last!.choice === 'phish' ? 'legit' : 'phish' });
    assert.equal(retry.status, 200, JSON.stringify(retry.body));
    assert.deepEqual(retry.body, { correct: false, alreadyAnswered: true, attemptFinished: true }, 'the first answer counts');
    const progress = await api.get(`/players/${playerId}`);
    assert.equal(progress.body.finishedAttempts, 1);
  } finally {
    await cls.remove();
  }
});
