// End-to-end smoke test against a running Hooked deployment:
//   npm run smoke -- https://your-app.up.railway.app
// health → create class → join → start attempt → answer → rejoin → teacher summary →
// teacher settings → delete class (always
// attempted, even after a failure). Exits non-zero if any step fails.
import type {
  AttemptProgress,
  ClassSummary,
  CreateClassResponse,
  JoinClassResponse,
  PlayerProgress,
  RejoinResponse,
  SubmitAnswerResponse,
} from '../shared/api.ts';
import { messages } from '../shared/messages.ts';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: npm run smoke -- <url>   (e.g. https://hooked-production-f0a4.up.railway.app)');
  process.exit(2);
}
const base = new URL(arg).origin;
const TIMEOUT_MS = 15_000;

class StepError extends Error {}

async function call<T>(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string>; expect: number }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(base + path, {
      method,
      headers: { ...(opts.body !== undefined && { 'Content-Type': 'application/json' }), ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new StepError(`${method} ${path} failed: ${(err as Error).message}`);
  }
  const text = await res.text();
  if (res.status !== opts.expect) {
    throw new StepError(`${method} ${path} returned ${res.status}, expected ${opts.expect}: ${text.slice(0, 200)}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

function check(condition: boolean, message: string): void {
  if (!condition) throw new StepError(message);
}

let failures = 0;
async function step(name: string, fn: () => Promise<string | void>): Promise<boolean> {
  const started = Date.now();
  try {
    const detail = await fn();
    console.log(`✓ ${name} (${Date.now() - started} ms)${detail ? ` - ${detail}` : ''}`);
    return true;
  } catch (err) {
    failures++;
    console.log(`✗ ${name}: ${err instanceof StepError ? err.message : String(err)}`);
    return false;
  }
}

console.log(`Smoke testing ${base}\n`);

let cls: CreateClassResponse | null = null;
let deleted = false;

try {
  if (!(await step('health', async () => {
    const health = await call<{ ok: boolean }>('GET', '/api/health', { expect: 200 });
    check(health.ok === true, `health returned ${JSON.stringify(health)}`);
  }))) throw new Error('stop');

  if (!(await step('create class', async () => {
    cls = await call<CreateClassResponse>('POST', '/api/classes', { expect: 201 });
    check(/^[A-Z2-9]{6}$/.test(cls.code), `unexpected code ${cls.code}`);
    check(cls.teacherKey.length === 43, 'teacher key has the wrong length');
    return `class ${cls.code}`;
  }))) throw new Error('stop');
  const { code, teacherKey } = cls!;
  const teacher = { 'X-Teacher-Key': teacherKey };

  const nickname = 'Smoke test';
  let playerId = '';
  let rejoinCode = '';
  if (!(await step('join', async () => {
    ({ playerId, rejoinCode } = await call<JoinClassResponse>('POST', `/api/classes/${code}/join`, { body: { nickname }, expect: 201 }));
    check(/^[0-9a-f-]{36}$/.test(playerId), `unexpected player id ${playerId}`);
    check(/^[A-Z2-9]{6}$/.test(rejoinCode), `unexpected rejoin code ${rejoinCode}`);
    return 'rejoin code issued';
  }))) throw new Error('stop');

  let attemptId = '';
  if (!(await step('start attempt', async () => {
    ({ attemptId } = await call<AttemptProgress>('POST', `/api/players/${playerId}/attempts`, { expect: 200 }));
    check(/^[0-9a-f-]{36}$/.test(attemptId), `unexpected attempt id ${attemptId}`);
  }))) throw new Error('stop');

  const message = messages[0];
  await step('submit answer', async () => {
    const choice = message.isPhish ? 'phish' : 'legit';
    const result = await call<SubmitAnswerResponse>('POST', '/api/answers', { body: { playerId, attemptId, messageId: message.id, choice }, expect: 201 });
    check(result.correct === true && !result.alreadyAnswered, `server graded the right answer as ${JSON.stringify(result)}`);
    return `${message.id} graded correct by the server`;
  });

  await step('rejoin and resume', async () => {
    const rejoined = await call<RejoinResponse>('POST', `/api/classes/${code}/rejoin`, { body: { nickname, rejoinCode }, expect: 200 });
    check(rejoined.playerId === playerId, 'rejoin returned a different player');
    const progress = await call<PlayerProgress>('GET', `/api/players/${playerId}`, { expect: 200 });
    check(progress.currentAttempt?.attemptId === attemptId && progress.currentAttempt.answers.length === 1, `progress ${JSON.stringify(progress.currentAttempt)}`);
    return 'same player, 1 answer to resume from';
  });

  await step('summary with teacher key', async () => {
    await call('GET', `/api/classes/${code}/summary`, { expect: 401 }); // no key: refused
    const summary = await call<ClassSummary>('GET', `/api/classes/${code}/summary`, { headers: teacher, expect: 200 });
    const player = summary.players[0];
    check(summary.playerCount === 1, `playerCount ${summary.playerCount}, expected 1`);
    check(player?.inProgress === 1 && player.attempts === 0 && player.best === null && !player.passed, `player row ${JSON.stringify(player)}`);
    check(summary.targetPercent === 80, `targetPercent ${summary.targetPercent}`);
    check(!Number.isNaN(Date.parse(summary.expiresAt)), 'missing expiresAt');
    return `1 player in progress (1/${summary.totalMessages}), target ${summary.targetPercent}%`;
  });

  await step('teacher settings', async () => {
    await call('PATCH', `/api/classes/${code}`, { headers: teacher, body: { targetPercent: 70 }, expect: 200 });
    const summary = await call<ClassSummary>('GET', `/api/classes/${code}/summary`, { headers: teacher, expect: 200 });
    check(summary.targetPercent === 70, `target ${summary.targetPercent}, expected 70`);
    const { rejoinCode: fresh } = await call<{ rejoinCode: string }>('POST', `/api/classes/${code}/players/${playerId}/rejoin-code`, { headers: teacher, expect: 200 });
    await call('POST', `/api/classes/${code}/rejoin`, { body: { nickname, rejoinCode }, expect: 401 });
    await call('POST', `/api/classes/${code}/rejoin`, { body: { nickname, rejoinCode: fresh }, expect: 200 });
    return 'target 70%, rejoin code reset';
  });

  await step('delete class', async () => {
    await call('DELETE', `/api/classes/${code}`, { headers: teacher, expect: 204 });
    deleted = true;
    await call('GET', `/api/classes/${code}/status`, { expect: 404 });
    return 'class gone';
  });
} catch (err) {
  if ((err as Error).message !== 'stop') throw err;
} finally {
  // Never leave a test class behind, whatever failed above.
  const created = cls as CreateClassResponse | null;
  if (created && !deleted) {
    await step('cleanup (delete class after failure)', async () => {
      await call('DELETE', `/api/classes/${created.code}`, { headers: { 'X-Teacher-Key': created.teacherKey }, expect: 204 });
    });
  }
}

console.log(failures ? `\nFAILED: ${failures} step(s) failed` : '\nAll smoke checks passed');
process.exit(failures ? 1 : 0);
