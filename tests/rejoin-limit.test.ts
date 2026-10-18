// Audit F7: padding the class code with whitespace doesn't get a fresh per-class rejoin budget.
// The server trusts two proxy hops here (like production), so each request can come from its
// own client IP and only the per-class limit applies.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer({ RAILWAY_ENVIRONMENT_ID: 'test' });
});
after(() => server.stop());

const from = (n: number) => ({ 'X-Forwarded-For': `10.1.${Math.floor(n / 250)}.${n % 250}, 192.0.2.1` });

test('padded class codes share the per-class rejoin limit', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  try {
    await cls.join('Target');
    for (let i = 0; i < 30; i++) {
      const res = await api.post(`/classes/${cls.code}/rejoin`, { nickname: 'Target', rejoinCode: 'AAAAAA' }, from(i));
      assert.equal(res.status, 401);
    }
    for (const padded of [`%20${cls.code}`, `${cls.code}%20`, `%09${cls.code}`]) {
      const res = await api.post(`/classes/${padded}/rejoin`, { nickname: 'Target', rejoinCode: 'AAAAAA' }, from(100));
      assert.equal(res.status, 429, `${padded} is limited with the class`);
    }
  } finally {
    await cls.remove();
  }
});
