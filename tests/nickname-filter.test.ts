// Audit F12: new nicknames can't hide invisible characters or render blank. Emoji with
// joiners still work, and a student who joined under the old rule can still rejoin.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

const REJECTED: [string, string][] = [
  ['Sam\u2060', 'word joiner'],
  ['Sa\u00ADm', 'soft hyphen'],
  ['Sam\u200D', 'a joiner outside an emoji'],
  ['Sam\u061C', 'Arabic letter mark'],
  ['Sam\uE000', 'private use'],
  ['Sam\uFE00', 'variation selector after a letter'],
  ['\u3164', 'Hangul filler'],
  ['\u115F\u1160', 'Hangul choseong and jungseong fillers'],
  ['\u2800', 'braille blank'],
  ['\u2800\u2800 \u2800', 'braille blanks and a space'],
  ['\u0301', 'a lone combining mark'],
];
const ACCEPTED = ['Sam', 'José', 'Zoë', '李华', 'O’Neil', 'Ana ❤\uFE0F', '👩\u200D💻 Dev', '👍🏽 Kai', '1\uFE0F\u20E3 Uno', '🇫🇷 Léa', '!!!'];

test('join rejects invisible and blank nicknames and keeps real ones', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  try {
    for (const [name, why] of REJECTED) {
      const res = await cls.join(name);
      assert.equal(res.status, 400, `${why} (${JSON.stringify(name)}) is rejected`);
    }
    for (const name of ACCEPTED) {
      const res = await cls.join(name);
      assert.equal(res.status, 201, `${JSON.stringify(name)} is accepted: ${JSON.stringify(res.body)}`);
    }
  } finally {
    await cls.remove();
  }
});

test('a student whose name predates the rule can still rejoin', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    assert.equal((await db.query('select current_database() as d')).rows[0].d, 'hooked_dev', 'only ever run against the dev database');
    const joined = await cls.join('Old');
    await db.query('UPDATE "Player" SET nickname = $1 WHERE id = $2', ['Old\u2060', joined.body.playerId]);
    const rejoin = await api.post(`/classes/${cls.code}/rejoin`, { nickname: 'Old\u2060', rejoinCode: joined.body.rejoinCode });
    assert.equal(rejoin.status, 200);
    assert.equal(rejoin.body.playerId, joined.body.playerId);
  } finally {
    await db.end();
    await cls.remove();
  }
});
