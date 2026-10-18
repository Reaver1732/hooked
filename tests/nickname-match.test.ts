// Audit F11: nickname checks are exact (case-insensitive) comparisons, not ILIKE patterns, so
// _ % and \ are ordinary characters in join and rejoin.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('_ % and \\ are plain characters in nicknames', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  try {
    assert.equal((await cls.join('Bob')).status, 201);
    assert.equal((await cls.join('bob')).status, 409, 'same name in another case is still taken');
    const underscore = await cls.join('B_b');
    assert.equal(underscore.status, 201, 'B_b is not "taken" by Bob');
    assert.equal((await cls.join('B%')).status, 201, 'B% is not "taken" by Bob');
    assert.equal((await cls.join('Bo\\')).status, 201, 'a trailing backslash is fine');
    assert.equal((await cls.join('bo\\')).status, 409, 'and is still checked for duplicates');

    const rejoin = await api.post(`/classes/${cls.code}/rejoin`, { nickname: 'b_b', rejoinCode: underscore.body.rejoinCode });
    assert.equal(rejoin.status, 200);
    assert.equal(rejoin.body.playerId, underscore.body.playerId, 'rejoin finds B_b, not Bob');
  } finally {
    await cls.remove();
  }
});
