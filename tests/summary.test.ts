// Audit F5: dashboard summaries are limited per class (after the key check) and concurrent
// requests share one read; a change to the class is visible on the very next summary.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('summary is limited per class, wrong keys do not count, changes show at once', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const a = await makeClass(api);
  const b = await makeClass(api);
  try {
    for (let i = 0; i < 5; i++) {
      const wrong = await api.get(`/classes/${a.code}/summary`, { 'X-Teacher-Key': 'x'.repeat(43) });
      assert.equal(wrong.status, 401);
    }
    const burst = await Promise.all(Array.from({ length: 61 }, () => api.get(`/classes/${a.code}/summary`, a.teacher)));
    const statuses = burst.map((r) => r.status).sort();
    assert.equal(statuses.filter((s) => s === 200).length, 60, '60 summaries a minute per class');
    assert.equal(statuses.filter((s) => s === 429).length, 1, 'the 61st is limited');
    assert.equal(burst.find((r) => r.status === 200)!.body.code, a.code);

    assert.equal((await api.get(`/classes/${b.code}/summary`, b.teacher)).status, 200, "another class isn't affected");
    assert.equal((await api.patch(`/classes/${b.code}`, { targetPercent: 70 }, b.teacher)).status, 200);
    assert.equal((await api.get(`/classes/${b.code}/summary`, b.teacher)).body.targetPercent, 70, 'the change shows on the next summary');
  } finally {
    await a.remove();
    await b.remove();
  }
});
