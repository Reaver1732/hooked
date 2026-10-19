// Sanity check for the harness itself: a server starts, answers health, and serves the API.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('health answers ok', async () => {
  const res = await client(server.base).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test('a class can be created, joined and deleted', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  const joined = await cls.join('Harness');
  assert.equal(joined.status, 201);
  assert.equal((await cls.remove()).status, 204);
});
