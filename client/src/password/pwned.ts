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
  for (const line of (await res.text()).split('\n')) {
    const [rowSuffix, rowCount] = line.trim().split(':');
    const count = Number(rowCount);
    // Rows with a count of 0 are padding added because of the Add-Padding header.
    if (!rowSuffix || !Number.isFinite(count) || count === 0) continue;
    candidates++;
    if (rowSuffix.toUpperCase() === suffix) breachCount = count;
  }
  return { breachCount, candidates };
}
