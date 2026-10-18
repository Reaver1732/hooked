// EFF Short Wordlist 1 (1,296 words, CC BY 3.0): https://www.eff.org/dice
// Each line is "<four dice digits>\t<word>". The file ships unchanged; the words below are left
// out at load time so a passphrase shown to a 12-year-old never reads "keg poker grope".
// Vite emits the list as a separate asset and we fetch it only when the password screen opens.
// (A plain fetch, not a dynamic import, because browsers cache a failed import forever.)
import wordlistUrl from './eff_short_wordlist_1.txt?url';

/** Words removed for school use, by reason. 73 in all, leaving 1,223. */
export const REMOVED_WORDS: Record<string, string[]> = {
  drugs: ['acid', 'blunt', 'coke', 'dose', 'junky'],
  alcohol: ['cider', 'keg'],
  gambling: ['poker', 'wager'],
  sex: ['boned', 'flirt', 'grope', 'hump', 'hunk', 'panty', 'prude', 'thong', 'vixen'],
  violence: ['armed', 'arson', 'blade', 'bully', 'gore', 'lance', 'lash', 'mace', 'riot', 'slash', 'wound'],
  death: ['coma', 'drown', 'grave', 'slain', 'widow'],
  religion: ['angel', 'bless', 'cult', 'islam', 'pagan', 'saint', 'sect', 'tarot'],
  politics: ['trump'],
  // Hate, and words that get thrown at someone as insults.
  hateful: ['chump', 'ditzy', 'dwarf', 'geek', 'hate', 'nerd', 'slob', 'wimp'],
  body: [
    'ankle', 'body', 'boney', 'bony', 'bust', 'cheek', 'elbow', 'femur', 'fetal', 'gut', 'jaws',
    'knee', 'limb', 'lip', 'liver', 'lung', 'mouth', 'thigh', 'thumb', 'tummy', 'womb', 'wrist',
  ],
};
const REMOVED = new Set(Object.values(REMOVED_WORDS).flat());

/** The EFF list's words minus REMOVED_WORDS. */
export function parseWordlist(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.split('\t')[1]?.trim())
    .filter((word): word is string => !!word && !REMOVED.has(word));
}

let wordlist: Promise<string[]> | null = null;

export function loadWordlist(): Promise<string[]> {
  wordlist ??= fetch(wordlistUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`Wordlist request failed with HTTP ${res.status}`);
      return res.text();
    })
    .then(parseWordlist)
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

/** Five words from 1,223 is about 51.3 bits of entropy, about as much as four from the long list. */
export function generatePassphrase(words: string[], wordCount = 5): string[] {
  return Array.from({ length: wordCount }, () => words[randomIndex(words.length)]);
}
