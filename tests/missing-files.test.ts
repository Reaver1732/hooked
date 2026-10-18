// Audit F67: a missing static file is a 404, not index.html with 200.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

const built = fs.existsSync(path.resolve(import.meta.dirname, '../client/dist/index.html'));

test('missing assets and files are 404', { skip: !built && 'needs a client build' }, async () => {
  for (const url of ['/assets/eff_large_wordlist-OLDHASH.txt', '/assets/nope', '/robots.txt', '/favicon.ico']) {
    const res = await fetch(server.base + url);
    assert.equal(res.status, 404, url);
    assert.doesNotMatch(await res.text(), /<html/i, url);
  }
});

test('app routes still get the app', { skip: !built && 'needs a client build' }, async () => {
  for (const url of ['/', '/?join=ABCDEF', '/anything']) {
    const res = await fetch(server.base + url);
    assert.equal(res.status, 200, url);
    assert.match(await res.text(), /<div id="root">/, url);
  }
  assert.equal((await fetch(server.base + '/favicon.svg')).status, 200, 'real files are served');
});
