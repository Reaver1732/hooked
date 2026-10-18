// Audit F33 and F25: while the database is down, requests fail with server errors, and those
// must not use up rate limits (which would lock a network out after the database comes back).
// F25 also: junk class-creation requests don't count.
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

test('failed and rejected class creations do not use up the creation limit', async () => {
  const api = client(server.base);
  for (let i = 0; i < 12; i++) {
    assert.equal((await api.post('/classes', { junk: true })).status, 400, 'junk body rejected');
  }
  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) statuses.push((await api.post('/classes')).status);
  assert.ok(statuses.every((s) => s >= 500), `outage errors, no 429: ${[...new Set(statuses)].join(',')}`);
});
