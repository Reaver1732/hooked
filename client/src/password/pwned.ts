// Have I Been Pwned "range" lookup (k-anonymity): only the first 5 hex characters
// of the password's SHA-1 hash ever leave the browser. The suffix is compared here.
const RANGE_URL = 'https://api.pwnedpasswords.com/range/';

export const PREFIX_LENGTH = 5;

export async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export type RangeResult = {
  /** Times this exact password appears in known breaches; 0 if not found. */
  breachCount: number;
  /** Real (non-padding) hash suffixes the API returned for the prefix. */
  candidates: number;
};

// One row of a range response: the rest of the SHA-1 hash, then how often it was seen.
const ROW_PATTERN = /^([0-9A-Fa-f]{35}):(\d+)$/;

export async function lookupHash(hash: string, signal?: AbortSignal): Promise<RangeResult> {
  const prefix = hash.slice(0, PREFIX_LENGTH);
  const suffix = hash.slice(PREFIX_LENGTH);

  const res = await fetch(RANGE_URL + prefix, {
    headers: { 'Add-Padding': 'true' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  });
  if (!res.ok) throw new Error(`Range lookup failed with HTTP ${res.status}`);

  let breachCount = 0;
  let candidates = 0;
  let rows = 0;
  for (const line of (await res.text()).split('\n')) {
    const row = ROW_PATTERN.exec(line.trim());
    if (!row) continue;
    rows++;
    const count = Number(row[2]);
    // Rows with a count of 0 are padding added because of the Add-Padding header.
    if (count === 0) continue;
    candidates++;
    if (row[1].toUpperCase() === suffix) breachCount = count;
  }
  // A real answer always has rows (padding guarantees hundreds). None means something else
  // answered, like a school web filter's block page: that's an error, not "not found".
  if (rows === 0) throw new Error('Range lookup returned no hash rows');
  return { breachCount, candidates };
}
