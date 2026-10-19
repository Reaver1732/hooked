// Audit F56: /api/health stays 200 and fast, and says whether class mode can reach its
// database, without ever waiting on it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasDatabase, startServer } from './helpers.ts';

async function settledHealth(base: string) {
  for (let i = 0; i < 60; i++) {
    const started = Date.now();
    const res = await fetch(`${base}/api/health`);
    const ms = Date.now() - started;
    assert.equal(res.status, 200);
    assert.ok(ms < 1000, `health answered in ${ms} ms`);
    const body = await res.json();
    assert.equal(body.ok, true);
    if (body.db !== 'checking') return body.db;
    await new Promise((r) => setTimeout(r, 250));
  }
  return 'checking';
}

test('db is ok with a working database', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const server = await startServer();
  try {
    assert.equal(await settledHealth(server.base), 'ok');
  } finally {
    await server.stop();
  }
});

test('db is down when the database is unreachable, and health stays fast', async () => {
  const server = await startServer({ DATABASE_URL: 'postgresql://u:p@127.0.0.1:9/nodb' });
  try {
    assert.equal(await settledHealth(server.base), 'down');
  } finally {
    await server.stop();
  }
});

test('db is unconfigured without DATABASE_URL', async () => {
  const server = await startServer({ DATABASE_URL: '' });
  try {
    assert.equal(await settledHealth(server.base), 'unconfigured');
  } finally {
    await server.stop();
  }
});
