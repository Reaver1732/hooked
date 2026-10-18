import { storedClasses } from './storage.ts';

// The teacher key travels in the URL hash: browsers never send the hash to a server
// or put it in the Referer header, so it only lives in the teacher's browser.
//
// The full link, with the key, is what the teacher saves. Once it's opened, the key moves into
// this tab's memory and the address bar shows only #dashboard/CODE, so the key isn't on screen
// while projecting and doesn't pile up in history. The key is found again from this tab's
// sessionStorage, or from the classes this browser created.
const KEYED_HASH = /^#dashboard\/([A-Z0-9]{6})\/([A-Za-z0-9_-]{43})$/;
const SHORT_HASH = /^#dashboard\/([A-Z0-9]{6})$/;
const SESSION_KEYS = 'hooked.dashboardKeys';

export type TeacherCredentials = { code: string; teacherKey: string };

/** What the address bar shows for a dashboard: the class code only. */
export function dashboardHash({ code }: Pick<TeacherCredentials, 'code'>): string {
  return `#dashboard/${code}`;
}

/** The private link, with the key, for opening the dashboard in another tab or browser. */
export function dashboardLinkHash({ code, teacherKey }: TeacherCredentials): string {
  return `#dashboard/${code}/${teacherKey}`;
}

export function dashboardUrl(credentials: TeacherCredentials): string {
  return `${window.location.origin}/${dashboardLinkHash(credentials)}`;
}

// sessionStorage can be blocked; this tab's memory still works until a reload.
const memoryKeys = new Map<string, string>();

function sessionKeys(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(SESSION_KEYS) ?? '{}');
    return value && typeof value === 'object' ? (value as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeSessionKeys(keys: Record<string, string>): void {
  try {
    window.sessionStorage.setItem(SESSION_KEYS, JSON.stringify(keys));
  } catch {
    // Storage unavailable: memoryKeys covers this page load.
  }
}

export function rememberDashboardKey({ code, teacherKey }: TeacherCredentials): void {
  memoryKeys.set(code, teacherKey);
  writeSessionKeys({ ...sessionKeys(), [code]: teacherKey });
}

export function forgetDashboardKey(code: string): void {
  memoryKeys.delete(code);
  const { [code]: _, ...rest } = sessionKeys();
  writeSessionKeys(rest);
}

/**
 * The dashboard the address bar points at, if this tab can open it. A full link is accepted
 * and shortened in place (replaceState, so no history entry and no hashchange).
 */
export function takeDashboardHash(): TeacherCredentials | null {
  const keyed = KEYED_HASH.exec(window.location.hash);
  if (keyed) {
    const credentials = { code: keyed[1], teacherKey: keyed[2] };
    rememberDashboardKey(credentials);
    window.history.replaceState(window.history.state, '', dashboardHash(credentials));
    return credentials;
  }
  const short = SHORT_HASH.exec(window.location.hash);
  if (!short) return null;
  const code = short[1];
  const teacherKey = memoryKeys.get(code) ?? sessionKeys()[code] ?? storedClasses().find((c) => c.code === code)?.teacherKey;
  return typeof teacherKey === 'string' && teacherKey ? { code, teacherKey } : null;
}
