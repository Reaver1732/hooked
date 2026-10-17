import { CLASS_CODE_ALPHABET, CLASS_CODE_LENGTH } from '../../../shared/api.ts';

const CODE_PATTERN = new RegExp(`^[${CLASS_CODE_ALPHABET}]{${CLASS_CODE_LENGTH}}$`);

/** <site>/?join=CODE: opens the join screen with the code filled in. */
export function joinUrl(code: string): string {
  return `${window.location.origin}/?join=${code}`;
}

/**
 * Reads and removes ?join=CODE from the address bar, so a refresh after joining
 * doesn't land back on the join screen. Returns null for a missing or malformed code.
 */
export function takeJoinParam(): string | null {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get('join');
  if (raw === null) return null;
  url.searchParams.delete('join');
  window.history.replaceState(null, '', url);
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}
