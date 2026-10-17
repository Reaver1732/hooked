// Verifies every message's link tokens and highlights. Exits non-zero on any problem:
// - each {{n}} in a body must point at an existing link, and every link must be referenced
// - each highlight.match must appear exactly once in from / subject / rendered body
import { messages, type Message } from '../client/src/data/messages.ts';
import { parseBody, renderBodyText } from '../client/src/data/linkTokens.ts';

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) count++;
  return count;
}

function searchableFields(m: Message): string[] {
  return [m.from.name, m.from.address, m.subject ?? '', renderBodyText(m)];
}

const errors: string[] = [];
const seenIds = new Set<string>();

for (const m of messages) {
  if (seenIds.has(m.id)) errors.push(`[${m.id}] duplicate message id`);
  seenIds.add(m.id);

  const referenced = new Set<number>();
  for (const part of parseBody(m.body)) {
    if (part.kind !== 'link') continue;
    if (part.index >= m.links.length) {
      errors.push(`[${m.id}] body references ${part.raw} but there are only ${m.links.length} link(s)`);
    }
    referenced.add(part.index);
  }
  m.links.forEach((link, i) => {
    if (!referenced.has(i)) errors.push(`[${m.id}] links[${i}] ("${link.text}") is never referenced as {{${i}}} in the body`);
  });

  const fields = searchableFields(m);
  for (const h of m.highlights) {
    if (!h.match) {
      errors.push(`[${m.id}] highlight has an empty match`);
      continue;
    }
    const n = fields.reduce((sum, f) => sum + countOccurrences(f, h.match), 0);
    if (n !== 1) errors.push(`[${m.id}] "${h.match}" found ${n} times (expected exactly 1)`);
  }
}

if (errors.length) {
  console.error(`check:messages failed with ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`check:messages OK: ${messages.length} messages, ${messages.reduce((s, m) => s + m.highlights.length, 0)} highlights`);
