// EFF Long Wordlist (7,776 words, CC BY 3.0): https://www.eff.org/dice
// Each line is "<five dice digits>\t<word>". The file is ~100 KB, so it isn't bundled:
// Vite emits it as a separate asset and we fetch it only when the password screen opens.
// (A plain fetch, not a dynamic import, because browsers cache a failed import forever.)
import wordlistUrl from './eff_large_wordlist.txt?url';

let wordlist: Promise<string[]> | null = null;

export function loadWordlist(): Promise<string[]> {
  wordlist ??= fetch(wordlistUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`Wordlist request failed with HTTP ${res.status}`);
      return res.text();
    })
    .then((text) =>
      text
        .split('\n')
        .map((line) => line.split('\t')[1]?.trim())
        .filter((word): word is string => !!word),
    )
    .catch((err: unknown) => {
      wordlist = null; // let the next call retry, e.g. after a dropped connection
      throw err;
    });
  return wordlist;
}

/** Uniform random integer in [0, n), using rejection sampling to avoid modulo bias. */
function randomIndex(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}

/** Four words from 7,776 is about 51.7 bits of entropy. */
export function generatePassphrase(words: string[], wordCount = 4): string[] {
  return Array.from({ length: wordCount }, () => words[randomIndex(words.length)]);
}
