// Audit F71: hashed /assets files are cached for a year; index.html is revalidated every time.
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

const assets = path.resolve(import.meta.dirname, '../client/dist/assets');

test('hashed assets are immutable for a year', { skip: !fs.existsSync(assets) && 'needs a client build' }, async () => {
  const js = fs.readdirSync(assets).find((f) => f.endsWith('.js'));
  const res = await fetch(`${server.base}/assets/${js}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
});

test('index.html is revalidated, at / and through the app fallback', { skip: !fs.existsSync(assets) && 'needs a client build' }, async () => {
  for (const url of ['/', '/index.html', '/some/client/route']) {
    const res = await fetch(server.base + url);
    assert.equal(res.status, 200, url);
    assert.equal(res.headers.get('cache-control'), 'no-cache', url);
    assert.match(await res.text(), /<div id="root">/, url);
  }
});
