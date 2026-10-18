// Audit F70: on SIGTERM the server stops taking new connections, lets an open request finish,
// then exits 0.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import pg from 'pg';
import { client, hasDatabase, makeClass } from './helpers.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

test('SIGTERM finishes the open request, refuses new ones, and exits 0', { skip: !hasDatabase && 'needs DATABASE_URL' }, async () => {
  const port = 39900 + Math.floor(Math.random() * 90);
  const child = spawn(process.execPath, ['--import', './tests/fixtures/signal-over-ipc.mjs', 'server/dist/server/src/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let output = '';
  child.stdout!.on('data', (d) => (output += d));
  child.stderr!.on('data', (d) => (output += d));
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) {
    if (await fetch(`${base}/api/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const api = client(base);
  const cls = await makeClass(api);
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    assert.equal((await db.query('select current_database() as d')).rows[0].d, 'hooked_dev', 'only ever run against the dev database');
    // Hold the class row so a join stays open while the server is told to stop.
    await db.query('BEGIN');
    await db.query('SELECT id FROM "Class" WHERE code = $1 FOR UPDATE', [cls.code]);
    const join = cls.join('InFlight');
    await new Promise((r) => setTimeout(r, 1000));
    child.send('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    const refused = await fetch(`${base}/api/health`).then(() => false, () => true);
    assert.equal(refused, true, 'new connections are refused while draining');
    await db.query('ROLLBACK');
    const res = await join;
    assert.equal(res.status, 201, 'the open join finished: ' + JSON.stringify(res.body));
    const code = await Promise.race([exited, new Promise((r) => setTimeout(() => r('still running'), 20_000))]);
    assert.equal(code, 0, output);
    assert.match(output, /SIGTERM: finishing open requests/);
  } finally {
    await db.query('ROLLBACK').catch(() => {});
    await db.end();
    if (child.exitCode === null) child.kill();
    // The server is gone; delete the class straight from the dev database.
    const cleanup = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cleanup.connect();
    await cleanup.query('DELETE FROM "Class" WHERE code = $1', [cls.code]);
    await cleanup.end();
  }
});
