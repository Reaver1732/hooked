// Audit F45: look-alike nicknames. Fullwidth letters fold to plain ones (so the duplicate check
// sees them), and Latin can't be mixed with Cyrillic or Greek. Whole-alphabet names are fine,
// and a folded name can be rejoined however it's typed.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('look-alike nicknames are caught, real ones are not', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  try {
    assert.equal((await cls.join('Sam')).status, 201);
    assert.equal((await cls.join('Ｓａｍ')).status, 409, 'fullwidth Sam is the same name');
    const cyrillicA = await cls.join('S' + String.fromCodePoint(0x0430) + 'm');
    assert.equal(cyrillicA.status, 400, 'Latin S and m with a Cyrillic а');
    assert.match(cyrillicA.body.error, /one alphabet/);
    assert.equal((await cls.join('Ωmega')).status, 400, 'Greek mixed with Latin');
    for (const name of ['Алексей', 'Δέλτα', 'Zoë', '李华', 'Sam 2']) {
      const res = await cls.join(name);
      assert.equal(res.status, 201, `${name}: ${JSON.stringify(res.body)}`);
    }

    const kim = await cls.join('ｋｉｍ');
    assert.equal(kim.status, 201);
    assert.equal(kim.body.nickname, 'kim', 'stored folded');
    for (const typed of ['ｋｉｍ', 'Kim']) {
      const rejoin = await api.post(`/classes/${cls.code}/rejoin`, { nickname: typed, rejoinCode: kim.body.rejoinCode });
      assert.equal(rejoin.status, 200, `rejoin typed as ${typed}`);
      assert.equal(rejoin.body.playerId, kim.body.playerId);
    }
  } finally {
    await cls.remove();
  }
});
