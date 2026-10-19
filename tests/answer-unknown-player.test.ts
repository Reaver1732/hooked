// Audit F22: answers for made-up player ids are limited per IP (failure path only), and a real
// player on the same network can still answer afterwards.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { messages } from '../shared/messages.ts';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('made-up answer senders are limited without blocking a real player', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  try {
    const statuses: number[] = [];
    for (let batch = 0; batch < 102; batch += 17) {
      const replies = await Promise.all(
        Array.from({ length: Math.min(17, 102 - batch) }, () =>
          api.post('/answers', { playerId: randomUUID(), attemptId: randomUUID(), messageId: messages[0].id, choice: 'phish' }),
        ),
      );
      statuses.push(...replies.map((r) => r.status));
    }
    assert.equal(statuses.filter((s) => s === 404).length, 100, '100 unknown senders get 404');
    assert.equal(statuses.filter((s) => s === 429).length, 2, 'then 429');

    const playerId = (await cls.join('Real')).body.playerId as string;
    const { attemptId } = (await api.post(`/players/${playerId}/attempts`)).body;
    const res = await api.post('/answers', { playerId, attemptId, messageId: messages[0].id, choice: 'phish' });
    assert.equal(res.status, 201, 'a real player on the same network still answers');
  } finally {
    await cls.remove();
  }
});
