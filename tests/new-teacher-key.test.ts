// Audit F15: a teacher can replace a leaked dashboard link. The old key stops working at once,
// the class and its results stay, and two replacements at once can't both win.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('a new teacher key replaces the old one and keeps the class', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  let key = cls.teacherKey;
  try {
    assert.equal((await cls.join('Kept')).status, 201);
    assert.equal((await api.post(`/classes/${cls.code}/teacher-key`)).status, 401, 'needs the current key');

    const res = await api.post(`/classes/${cls.code}/teacher-key`, {}, cls.teacher);
    assert.equal(res.status, 200);
    assert.match(res.body.teacherKey, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(res.body.teacherKey, cls.teacherKey);
    key = res.body.teacherKey;

    assert.equal((await api.get(`/classes/${cls.code}/summary`, cls.teacher)).status, 401, 'the old key stops working');
    const summary = await api.get(`/classes/${cls.code}/summary`, { 'X-Teacher-Key': key });
    assert.equal(summary.status, 200, 'the new key works');
    assert.deepEqual(summary.body.players.map((p: { nickname: string }) => p.nickname), ['Kept'], 'results are kept');
    assert.equal((await api.post(`/classes/${cls.code}/teacher-key`, {}, cls.teacher)).status, 401, 'the old key can’t make another');

    const both = await Promise.all([1, 2].map(() => api.post(`/classes/${cls.code}/teacher-key`, {}, { 'X-Teacher-Key': key })));
    const winners = both.filter((r) => r.status === 200);
    assert.equal(winners.length, 1, `exactly one of two at once wins: ${both.map((r) => r.status)}`);
    assert.ok(both.some((r) => r.status === 409 || r.status === 401), 'the other is refused');
    key = winners[0].body.teacherKey;
    assert.equal((await api.get(`/classes/${cls.code}/summary`, { 'X-Teacher-Key': key })).status, 200, 'the winner’s key works');
  } finally {
    await api.del(`/classes/${cls.code}`, { 'X-Teacher-Key': key });
  }
});
