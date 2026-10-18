// Audit F6: with a database host that never answers, class requests fail within seconds instead
// of hanging, and the server keeps serving the health check and the app.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  // 10.255.255.1 is unroutable: connections hang until a timeout gives up.
  server = await startServer({ DATABASE_URL: 'postgresql://u:p@10.255.255.1:5432/nodb' });
});
after(() => server.stop());

test('an unreachable database fails requests in seconds, not never', async () => {
  const started = Date.now();
  const res = await fetch(`${server.base}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(30_000),
  });
  const seconds = (Date.now() - started) / 1000;
  assert.ok(res.status >= 500, `server error, got ${res.status}`);
  assert.ok(seconds < 20, `answered in ${seconds.toFixed(1)} s`);
  assert.equal((await fetch(`${server.base}/api/health`)).status, 200, 'health still answers');
});
