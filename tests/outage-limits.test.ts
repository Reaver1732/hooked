// Audit F33: while the database is down, failed rejoins are server errors and must not count as
// wrong rejoin codes (which would lock the network out after the database comes back).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  // Nothing listens on port 9, so every database call fails fast.
  server = await startServer({ DATABASE_URL: 'postgresql://u:p@127.0.0.1:9/nodb' });
});
after(() => server.stop());

test('server errors during an outage do not use up the rejoin limits', async () => {
  const api = client(server.base);
  const statuses: number[] = [];
  for (let i = 0; i < 35; i++) {
    statuses.push((await api.post('/classes/ABCDEF/rejoin', { nickname: 'Sam', rejoinCode: 'AAAAAA' })).status);
  }
  assert.ok(statuses.every((s) => s >= 500), `all server errors, no 429: ${[...new Set(statuses)].join(',')}`);
});
