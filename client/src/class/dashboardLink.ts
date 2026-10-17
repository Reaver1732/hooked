// The teacher key travels in the URL hash: browsers never send the hash to a server
// or put it in the Referer header, so it only lives in the teacher's browser.
const HASH_PATTERN = /^#dashboard\/([A-Z0-9]{6})\/([A-Za-z0-9_-]{43})$/;

export type TeacherCredentials = { code: string; teacherKey: string };

export function dashboardHash({ code, teacherKey }: TeacherCredentials): string {
  return `#dashboard/${code}/${teacherKey}`;
}

export function dashboardUrl(credentials: TeacherCredentials): string {
  return `${window.location.origin}/${dashboardHash(credentials)}`;
}

export function readDashboardHash(hash = window.location.hash): TeacherCredentials | null {
  const match = HASH_PATTERN.exec(hash);
  return match ? { code: match[1], teacherKey: match[2] } : null;
}
