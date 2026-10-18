// Audit F21: failed teacher-key checks are capped per IP, which closes the 401-vs-404 class-code
// oracle, while a teacher with the right key on the same network is never blocked.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer({ RAILWAY_ENVIRONMENT_ID: 'test' });
});
after(() => server.stop());

const ip = (n: number) => ({ 'X-Forwarded-For': `10.3.0.${n}, 192.0.2.1` });

test('teacher-key failures are capped per IP without blocking the real teacher', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  try {
    const wrong = { 'X-Teacher-Key': 'w'.repeat(43) };
    for (let i = 0; i < 30; i++) {
      assert.equal((await api.get(`/classes/${cls.code}/summary`, { ...wrong, ...ip(1) })).status, 401);
    }
    assert.equal((await api.get(`/classes/${cls.code}/summary`, { ...wrong, ...ip(1) })).status, 429, 'the 31st failure is limited');
    assert.equal((await api.get('/classes/ZZZZZZ/summary', { ...wrong, ...ip(1) })).status, 429, 'unknown codes no longer answer 404');

    const real = await api.get(`/classes/${cls.code}/summary`, { ...cls.teacher, ...ip(1) });
    assert.equal(real.status, 200, 'the teacher with the right key, on the same network, still gets in');
    assert.equal((await api.get(`/classes/${cls.code}/summary`, { ...wrong, ...ip(2) })).status, 401, 'other networks are unaffected');
  } finally {
    await cls.remove();
  }
});
