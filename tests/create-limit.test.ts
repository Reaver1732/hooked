// Audit F25 (positive control): classes that are actually created still count, 10 an hour per IP.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, hasDatabase, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('the 11th class created in an hour is limited', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const made: { code: string; teacherKey: string }[] = [];
  try {
    for (let i = 0; i < 10; i++) {
      const res = await api.post('/classes');
      assert.equal(res.status, 201);
      made.push(res.body);
    }
    assert.equal((await api.post('/classes')).status, 429);
  } finally {
    for (const c of made) await api.del(`/classes/${c.code}`, { 'X-Teacher-Key': c.teacherKey });
  }
});
