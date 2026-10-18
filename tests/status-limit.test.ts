// Audit F23: class status checks have their own budget, so they can't use up a network's joins.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('305 status checks leave joining open', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  try {
    const statuses: number[] = [];
    for (let batch = 0; batch < 305; batch += 25) {
      const n = Math.min(25, 305 - batch);
      const replies = await Promise.all(Array.from({ length: n }, () => api.get(`/classes/${cls.code}/status`)));
      statuses.push(...replies.map((r) => r.status));
    }
    assert.ok(statuses.every((s) => s === 200), `no 429 from status checks: ${[...new Set(statuses)].join(',')}`);
    assert.equal((await cls.join('StillWorks')).status, 201, 'joining still works from the same network');
  } finally {
    await cls.remove();
  }
});
