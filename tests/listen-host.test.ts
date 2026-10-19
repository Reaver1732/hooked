// Audit F78: locally the API listens on this machine only; on Railway it listens everywhere.
import assert from 'node:assert/strict';
import os from 'node:os';
import { test } from 'node:test';
import { startServer } from './helpers.ts';

const lanAddress = Object.values(os.networkInterfaces())
  .flat()
  .find((a) => a && a.family === 'IPv4' && !a.internal)?.address;

const reachable = async (url: string) => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
};

test('locally, only this machine can reach the server', { skip: !lanAddress && 'no network address to test from' }, async () => {
  const server = await startServer({ RAILWAY_ENVIRONMENT_ID: '' });
  try {
    const port = new URL(server.base).port;
    assert.equal(await reachable(`http://127.0.0.1:${port}/api/health`), true, '127.0.0.1');
    assert.equal(await reachable(`${server.base}/api/health`), true, 'localhost');
    assert.equal(await reachable(`http://${lanAddress}:${port}/api/health`), false, `the network address ${lanAddress}`);
  } finally {
    await server.stop();
  }
});

test('on Railway, the server listens on every interface', { skip: !lanAddress && 'no network address to test from' }, async () => {
  const server = await startServer({ RAILWAY_ENVIRONMENT_ID: 'test' });
  try {
    const port = new URL(server.base).port;
    assert.equal(await reachable(`http://${lanAddress}:${port}/api/health`), true, `the network address ${lanAddress}`);
  } finally {
    await server.stop();
  }
});
