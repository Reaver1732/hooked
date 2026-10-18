// What this browser remembers between visits, and nothing more: for teachers, the classes
// they created here; for students, which player they are in each class. No answers, no
// passwords. Every access is guarded: storage can be blocked, full, or disabled, and the
// app must work the same without it (just without "resume"). The tab's active class session
// (below) lives in sessionStorage instead.

const TEACHER_KEY = 'hooked.teacherClasses';
const PLAYER_KEY = 'hooked.players';

export type StoredClass = { code: string; teacherKey: string; createdAt: string };
export type StoredPlayer = { code: string; playerId: string; nickname: string };

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: resume just won't be offered next time.
  }
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

// ---- Teachers

export function storedClasses(): StoredClass[] {
  const value = read(TEACHER_KEY);
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is StoredClass => isString(c?.code) && isString(c?.teacherKey) && isString(c?.createdAt))
    .map(({ code, teacherKey, createdAt }) => ({ code, teacherKey, createdAt }));
}

export function rememberClass(entry: StoredClass): void {
  write(TEACHER_KEY, [entry, ...storedClasses().filter((c) => c.code !== entry.code)]);
}

export function forgetClass(code: string): void {
  write(TEACHER_KEY, storedClasses().filter((c) => c.code !== code));
}

// ---- Students

function storedPlayers(): StoredPlayer[] {
  const value = read(PLAYER_KEY);
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is StoredPlayer => isString(p?.code) && isString(p?.playerId) && isString(p?.nickname))
    .map(({ code, playerId, nickname }) => ({ code, playerId, nickname }));
}

export function storedPlayer(code: string): StoredPlayer | null {
  return storedPlayers().find((p) => p.code === code) ?? null;
}

export function rememberPlayer(entry: StoredPlayer): void {
  write(PLAYER_KEY, [entry, ...storedPlayers().filter((p) => p.code !== entry.code)]);
}

export function forgetPlayer(code: string): void {
  write(PLAYER_KEY, storedPlayers().filter((p) => p.code !== code));
}

// ---- This tab's class session
// Kept in sessionStorage so a refresh (or a Chromebook tab that was put to sleep) stays in the
// class. It's per tab, so someone opening a new window isn't signed in as this student.

const SESSION_KEY = 'hooked.activeClass';

/** The class this tab was playing in, if this browser still remembers that player. */
export function activeSession(): StoredPlayer | null {
  let value: unknown = null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    value = raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const { code, playerId } = value as Record<string, unknown>;
  if (!isString(code) || !isString(playerId)) return null;
  // Leave class, a removal, or a closed class forget the player, and that ends this too.
  const stored = storedPlayer(code);
  return stored && stored.playerId === playerId ? stored : null;
}

export function rememberActiveSession(entry: StoredPlayer): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(entry));
  } catch {
    // Storage unavailable: a refresh just drops back to the start screen without the class.
  }
}

export function forgetActiveSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to forget.
  }
}
