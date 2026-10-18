// Audit F55: if the port is taken, the server says so and exits with a failure status instead
// of logging "listening" and exiting 0.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { startServer, type TestServer } from './helpers.ts';

let server: TestServer;
before(async () => {
  server = await startServer();
});
after(() => server.stop());

test('a port clash exits with status 1 and a clear message', async () => {
  const port = new URL(server.base).port;
  const child = spawn(process.execPath, ['server/dist/server/src/index.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, PORT: port },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  const code = await new Promise<number | null>((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, 10_000);
    child.once('exit', (c) => {
      clearTimeout(timer);
      resolve(c);
    });
  });
  assert.equal(code, 1, output);
  assert.match(output, /couldn’t listen on port \d+: .*EADDRINUSE/);
  assert.doesNotMatch(output, /Server listening/);
});
