// Test helpers. Server tests start their own instance of the BUILT server (run `npm run build`
// first) on a random port, so each test file gets fresh in-memory rate limits. They need a
// DATABASE_URL for a development database in the environment, and skip without one.
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export type TestServer = { base: string; output: () => string; stop: () => Promise<void> };

export async function startServer(env: Record<string, string> = {}): Promise<TestServer> {
  // Test files run in parallel, so two servers can pick the same random port. Wait for this
  // child's own "listening" line (a clash makes it exit instead) and retry on another port,
  // so a test never ends up talking to another file's server.
  for (let tries = 0; ; tries++) {
    const server = await spawnServer(39000 + Math.floor(Math.random() * 900), env);
    if (server) return server;
    if (tries === 4) throw new Error('test server would not start');
  }
}

async function spawnServer(port: number, env: Record<string, string>): Promise<TestServer | null> {
  const child = spawn(process.execPath, ['server/dist/server/src/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  for (let i = 0; i < 150 && !output.includes('Server listening'); i++) {
    if (child.exitCode !== null) return null;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (child.exitCode !== null) return null;
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return {
    base,
    output: () => output,
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once('exit', () => resolve());
        child.kill();
      }),
  };
}

export type Reply = { status: number; body: any; headers: Headers };

export function client(base: string) {
  const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<Reply> => {
    const res = await fetch(`${base}/api${url}`, {
      method,
      headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // not JSON
    }
    return { status: res.status, body: parsed, headers: res.headers };
  };
  return {
    get: (url: string, headers?: Record<string, string>) => call('GET', url, undefined, headers),
    post: (url: string, body: unknown = {}, headers?: Record<string, string>) => call('POST', url, body, headers),
    patch: (url: string, body: unknown, headers?: Record<string, string>) => call('PATCH', url, body, headers),
    del: (url: string, headers?: Record<string, string>) => call('DELETE', url, undefined, headers),
  };
}

/** Creates a class and returns a helper bound to it; call `remove()` when done. */
export async function makeClass(api: ReturnType<typeof client>) {
  const created = await api.post('/classes');
  if (created.status !== 201) throw new Error(`create class failed: ${created.status} ${JSON.stringify(created.body)}`);
  const { code, teacherKey } = created.body as { code: string; teacherKey: string };
  const teacher = { 'X-Teacher-Key': teacherKey };
  return {
    code,
    teacherKey,
    teacher,
    join: (nickname: string) => api.post(`/classes/${code}/join`, { nickname }),
    remove: () => api.del(`/classes/${code}`, teacher),
  };
}
