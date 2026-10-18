import { CLASS_CODE_ALPHABET, CLASS_CODE_LENGTH } from '../../../shared/api.ts';

const CODE_PATTERN = new RegExp(`^[${CLASS_CODE_ALPHABET}]{${CLASS_CODE_LENGTH}}$`);

/** <site>/?join=CODE: opens the join screen with the code filled in. */
export function joinUrl(code: string): string {
  return `${window.location.origin}/?join=${code}`;
}

/**
 * The class code in what someone typed or pasted: the code itself, in any case and with spaces
 * or dashes, or a whole join link (so pasting the link into the code box doesn't give "HTTPSH").
 */
export function codeFromInput(value: string): string {
  const fromLink = /[?&]join=([^&#\s]*)/i.exec(value);
  let raw = fromLink ? fromLink[1] : value;
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Not percent-encoded; use it as it is.
  }
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Reads and removes ?join=CODE from the address bar, so a refresh after joining doesn't land
 * back on the join screen. Easily fixed codes (lowercase, a dash) are cleaned up. Returns the
 * code, `{ unusable }` with whatever could be salvaged for a link whose code still doesn't fit,
 * or null without a join link.
 */
export function takeJoinParam(): string | { unusable: string } | null {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get('join');
  if (raw === null) return null;
  url.searchParams.delete('join');
  window.history.replaceState(null, '', url);
  const code = codeFromInput(raw);
  return CODE_PATTERN.test(code) ? code : { unusable: code.slice(0, CLASS_CODE_LENGTH) };
}
