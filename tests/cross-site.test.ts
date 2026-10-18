// Audit F74: another website can't make its visitors' browsers change anything through the API
// (create classes, join, delete). Same-site pages, direct visits and non-browser clients can.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, hasDatabase, startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('cross-site writes are refused before they reach a route', async () => {
  const api = client(server.base);
  for (const site of ['cross-site', 'same-site']) {
    const res = await api.post('/classes', {}, { 'Sec-Fetch-Site': site, Origin: 'https://evil.example' });
    assert.equal(res.status, 403, `Sec-Fetch-Site: ${site}`);
    assert.match(res.body.error, /other websites/);
  }
  const oldSafari = await api.post('/classes', {}, { Origin: 'https://evil.example' });
  assert.equal(oldSafari.status, 403, 'without Sec-Fetch-Site, a foreign Origin is refused');
  const opaque = await api.post('/classes', {}, { Origin: 'null' });
  assert.equal(opaque.status, 403, 'an opaque origin (sandboxed iframe, file://) is refused');
  const del = await api.del('/classes/ABCDEF', { 'Sec-Fetch-Site': 'cross-site', 'X-Teacher-Key': 'x' });
  assert.equal(del.status, 403, 'DELETE is a write too');
});

test('reads pass from anywhere', async () => {
  const api = client(server.base);
  const res = await api.get('/health', { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' });
  assert.equal(res.status, 200);
  const status = await api.get('/classes/ABCDEF/status', { 'Sec-Fetch-Site': 'cross-site' });
  assert.equal(status.status, 404, 'reaches the route (no such class) instead of being refused');
});

test('same-origin pages, direct visits and scripts can write', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const api = client(server.base);
  const host = new URL(server.base).host;
  const cases: [string, Record<string, string>][] = [
    ['same-origin page', { 'Sec-Fetch-Site': 'same-origin', Origin: server.base.replace(/\/api$/, '') }],
    ['typed into the address bar', { 'Sec-Fetch-Site': 'none' }],
    ['older Safari on this site', { Origin: `http://${host}` }],
    ['a script with neither header', {}],
  ];
  for (const [why, headers] of cases) {
    const res = await api.post('/classes', {}, headers);
    assert.equal(res.status, 201, why);
    await api.del(`/classes/${res.body.code}`, { 'X-Teacher-Key': res.body.teacherKey });
  }
});
