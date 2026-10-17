// Verifies every message's link tokens and highlights. Exits non-zero on any problem:
// - each {{n}} in a body must point at an existing link, and every link must be referenced
// - only emails may have a subject or attachments (texts and DMs never show them)
// - each highlight.match must appear exactly once in from / subject / rendered body /
//   attachment names
import { messages, type Message } from '../shared/messages.ts';
import { parseBody, renderBodyText } from '../shared/linkTokens.ts';

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) count++;
  return count;
}

function searchableFields(m: Message): string[] {
  const subject = m.kind === 'email' ? (m.subject ?? '') : '';
  const attachmentNames = m.kind === 'email' ? (m.attachments ?? []).map((a) => a.name) : [];
  return [m.from.name, m.from.address, subject, renderBodyText(m), ...attachmentNames];
}

const errors: string[] = [];
const seenIds = new Set<string>();
const KINDS: Message['kind'][] = ['email', 'text', 'dm'];

for (const m of messages) {
  if (seenIds.has(m.id)) errors.push(`[${m.id}] duplicate message id`);
  seenIds.add(m.id);

  if (!KINDS.includes(m.kind)) errors.push(`[${m.id}] unknown kind "${m.kind}" (expected ${KINDS.join(', ')})`);
  if (m.kind !== 'email' && m.subject !== undefined) {
    errors.push(`[${m.id}] a ${m.kind} has no subject line; remove "subject"`);
  }
  if (m.kind !== 'email' && m.attachments !== undefined) {
    errors.push(`[${m.id}] only emails can have attachments; remove "attachments" from this ${m.kind}`);
  }
  m.attachments?.forEach((a, i) => {
    if (!a.name.trim() || !a.size.trim()) errors.push(`[${m.id}] attachments[${i}] needs both a name and a size`);
  });

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
