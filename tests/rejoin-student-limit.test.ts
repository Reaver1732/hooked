// Audit F8: rejoin guesses are limited per student, so wrong guesses against one nickname don't
// lock out the class; malformed requests don't count; and a teacher's reset works right away.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer({ RAILWAY_ENVIRONMENT_ID: 'test' });
});
after(() => server.stop());

const from = (n: number) => ({ 'X-Forwarded-For': `10.2.${Math.floor(n / 250)}.${n % 250}, 192.0.2.1` });

test('rejoin limits are per student, ignore malformed input, and reset with a new code', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  try {
    const target = (await cls.join('Target')).body as { playerId: string; rejoinCode: string };
    const other = (await cls.join('Other')).body as { playerId: string; rejoinCode: string };

    // 10 wrong guesses for Target, each from a different IP, then Target is limited.
    for (let i = 0; i < 10; i++) {
      assert.equal((await api.post(`/classes/${cls.code}/rejoin`, { nickname: 'Target', rejoinCode: 'AAAAAA' }, from(i))).status, 401);
    }
    const limited = await api.post(`/classes/${cls.code}/rejoin`, { nickname: 'target', rejoinCode: target.rejoinCode }, from(50));
    assert.equal(limited.status, 429, 'Target (any case) is limited, even with the right code');

    // A classmate in the same class is not.
    const ok = await api.post(`/classes/${cls.code}/rejoin`, { nickname: 'Other', rejoinCode: other.rejoinCode }, from(51));
    assert.equal(ok.status, 200, 'another student can still rejoin');

    // Malformed requests from one IP don't count toward anything.
    for (let i = 0; i < 40; i++) {
      assert.equal((await api.post(`/classes/${cls.code}/rejoin`, { nickname: 'Other', rejoinCode: 'x' }, from(60))).status, 400);
    }
    assert.equal((await api.post(`/classes/${cls.code}/rejoin`, { nickname: 'Other', rejoinCode: other.rejoinCode }, from(60))).status, 200);

    // The teacher resets Target's code: the new one works at once.
    const reset = await api.post(`/classes/${cls.code}/players/${target.playerId}/rejoin-code`, {}, cls.teacher);
    assert.equal(reset.status, 200);
    const back = await api.post(`/classes/${cls.code}/rejoin`, { nickname: 'Target', rejoinCode: reset.body.rejoinCode }, from(70));
    assert.equal(back.status, 200, 'the reset code works right away');
  } finally {
    await cls.remove();
  }
});
