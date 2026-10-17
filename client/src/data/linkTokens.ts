import type { Message } from './messages.ts';

// `{{0}}`, `{{1}}`, ... in a message body mark where links[0], links[1], ... render.
const LINK_TOKEN = /\{\{(\d+)\}\}/g;

export type BodyPart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; index: number; raw: string };

export function parseBody(body: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let last = 0;
  for (const m of body.matchAll(LINK_TOKEN)) {
    if (m.index > last) parts.push({ kind: 'text', text: body.slice(last, m.index) });
    parts.push({ kind: 'link', index: Number(m[1]), raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ kind: 'text', text: body.slice(last) });
  return parts;
}

/** The body as the player reads it: each token replaced by its link's text. */
export function renderBodyText(message: Message): string {
  return parseBody(message.body)
    .map((p) => (p.kind === 'text' ? p.text : (message.links[p.index]?.text ?? p.raw)))
    .join('');
}
