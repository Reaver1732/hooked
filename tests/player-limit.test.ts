// Audit F80: the player limit is per player, and made-up player ids can't use it up for real
// players on the same network.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('made-up ids are limited per IP without blocking real players', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  try {
    const a = (await cls.join('Ana')).body.playerId as string;
    const b = (await cls.join('Bo')).body.playerId as string;

    const statuses: number[] = [];
    for (let i = 0; i < 102; i++) statuses.push((await api.get(`/players/${randomUUID()}`)).status);
    assert.ok(statuses.slice(0, 100).every((s) => s === 404), 'first 100 unknown ids are 404');
    assert.equal(statuses[101], 429, 'then unknown ids are rate limited');

    assert.equal((await api.get(`/players/${a}`)).status, 200, 'a real player on the same IP still gets in');

    // That lookup was this player's first request; 59 more are allowed, then 429.
    const more: number[] = [];
    for (let i = 0; i < 60; i++) more.push((await api.get(`/players/${a}`)).status);
    assert.ok(more.slice(0, 59).every((s) => s === 200), 'one player has 60 requests per 10 minutes');
    assert.equal(more[59], 429, 'the 61st is limited');

    assert.equal((await api.get(`/players/${b}`)).status, 200, "another player isn't affected");
  } finally {
    await cls.remove();
  }
});
