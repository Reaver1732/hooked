// Audit F38: new nicknames can't stack "Zalgo" piles of combining marks on one letter; real
// names with accents (including Vietnamese, Thai and Hindi) still work.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, hasDatabase, makeClass, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

const marks = (...codePoints: number[]) => String.fromCodePoint(...codePoints);

test('stacked combining marks are rejected, real accents are not', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const cls = await makeClass(api);
  try {
    const zalgo = 'Z' + marks(0x0300, 0x0301, 0x0302, 0x0303, 0x0304, 0x0305, 0x0306, 0x0307, 0x0308, 0x0309) + 'ed';
    const res = await cls.join(zalgo);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /accent marks/);
    assert.equal((await cls.join('Ab' + marks(0x0301, 0x0302, 0x0303, 0x0304))).status, 400, 'four on one letter');
    for (const name of [
      'Nguyễn',
      'Nguye' + marks(0x0302, 0x0303), // decomposed: NFC brings it back together
      'สมศักดิ์', // Thai: vowel and tone marks
      'प्रिया', // Hindi: virama and vowel sign
      'Zoe' + marks(0x0301, 0x0302, 0x0303), // three is fine
    ]) {
      const ok = await cls.join(name);
      assert.equal(ok.status, 201, `${JSON.stringify(name)}: ${JSON.stringify(ok.body)}`);
    }
  } finally {
    await cls.remove();
  }
});
