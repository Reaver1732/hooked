import { storedClasses } from './storage.ts';

// The teacher key travels in the URL hash: browsers never send the hash to a server
// or put it in the Referer header, so it only lives in the teacher's browser.
//
// The full link, with the key, is what the teacher saves. Once it's opened, the key moves into
// this tab's memory and the address bar shows only #dashboard/CODE, so the key isn't on screen
// while projecting and doesn't pile up in history. The key is found again from this tab's
// sessionStorage, or from the classes this browser created.
// Parsed tolerantly: a pasted link can pick up spaces from line wrapping, a lowercase code, or a
// trailing slash or full stop. Anything that starts like a dashboard link but still doesn't fit
// is reported as incomplete, rather than silently opening the student start screen.
const DASHBOARD_HASH = /^#dashboard\/([A-Za-z0-9]{6})(?:\/([A-Za-z0-9_-]+))?$/;
const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
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

function cleanHash(raw: string): string {
  let hash = raw;
  try {
    hash = decodeURIComponent(hash);
  } catch {
    // Not percent-encoded; use it as it is.
  }
  return hash.replace(/\s+/g, '').replace(/[^A-Za-z0-9_-]+$/, '');
}

/**
 * The dashboard the address bar points at: its credentials if this tab can open it,
 * 'incomplete' if it looks like a dashboard link that can't be used (cut short, or the short
 * address in a browser without the key), or null if it isn't a dashboard link. A full link is
 * shortened in place (replaceState, so no history entry and no hashchange); an incomplete one
 * is cleared, so a reload lands on the start screen.
 */
export function takeDashboardHash(): TeacherCredentials | 'incomplete' | null {
  if (!/^#\/?dashboard/i.test(window.location.hash)) return null;
  const match = DASHBOARD_HASH.exec(cleanHash(window.location.hash).replace(/^#\/?dashboard/i, '#dashboard'));
  const code = match?.[1].toUpperCase();
  const linkKey = match?.[2];
  const teacherKey =
    code && (linkKey === undefined ? (memoryKeys.get(code) ?? sessionKeys()[code] ?? storedClasses().find((c) => c.code === code)?.teacherKey) : linkKey);
  if (!code || typeof teacherKey !== 'string' || !KEY_PATTERN.test(teacherKey)) {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    return 'incomplete';
  }
  const credentials = { code, teacherKey };
  if (linkKey !== undefined) rememberDashboardKey(credentials);
  if (window.location.hash !== dashboardHash(credentials)) {
    window.history.replaceState(window.history.state, '', dashboardHash(credentials));
  }
  return credentials;
}
