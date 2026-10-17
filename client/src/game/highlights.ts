import { parseBody } from '../data/linkTokens.ts';
import type { FakeLink, Message } from '../data/messages.ts';

export type Field = 'fromName' | 'fromAddress' | 'subject' | 'body';
const FIELDS: Field[] = ['fromName', 'fromAddress', 'subject', 'body'];

type Segment = { kind: 'text'; text: string } | { kind: 'link'; link: FakeLink };

/** Where one highlight (by index in message.highlights) falls in a field's displayed text. */
type Range = { index: number; start: number; end: number };

/**
 * A run of a field to render. `marked` means some highlight covers it; `badges` lists
 * the highlights that start here. A link piece is never split: if a highlight touches
 * any part of the link's text, the whole link is marked.
 */
export type Piece =
  | { kind: 'text'; text: string; marked: boolean; badges: number[] }
  | { kind: 'link'; link: FakeLink; marked: boolean; badges: number[] };

const segmentText = (s: Segment) => (s.kind === 'text' ? s.text : s.link.text);

function fieldSegments(message: Message): Record<Field, Segment[]> {
  return {
    fromName: [{ kind: 'text', text: message.from.name }],
    fromAddress: [{ kind: 'text', text: message.from.address }],
    subject: message.kind === 'email' && message.subject ? [{ kind: 'text', text: message.subject }] : [],
    body: parseBody(message.body).map((p): Segment => {
      if (p.kind === 'text') return { kind: 'text', text: p.text };
      const link = message.links[p.index];
      return link ? { kind: 'link', link } : { kind: 'text', text: p.raw };
    }),
  };
}

function toPieces(segments: Segment[], ranges: Range[]): Piece[] {
  const pieces: Piece[] = [];
  let offset = 0;
  for (const seg of segments) {
    const a = offset;
    const b = offset + segmentText(seg).length;
    offset = b;

    if (seg.kind === 'link') {
      pieces.push({
        kind: 'link',
        link: seg.link,
        marked: ranges.some((r) => r.start < b && r.end > a),
        badges: ranges.filter((r) => r.start >= a && r.start < b).map((r) => r.index),
      });
      continue;
    }

    // Cut the text at every highlight boundary inside it, so overlapping highlights work too.
    const cuts = new Set([a, b]);
    for (const r of ranges) {
      if (r.start > a && r.start < b) cuts.add(r.start);
      if (r.end > a && r.end < b) cuts.add(r.end);
    }
    const points = [...cuts].sort((x, y) => x - y);
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i];
      const q = points[i + 1];
      pieces.push({
        kind: 'text',
        text: seg.text.slice(p - a, q - a),
        marked: ranges.some((r) => r.start <= p && r.end >= q),
        badges: ranges.filter((r) => r.start === p).map((r) => r.index),
      });
    }
  }
  return pieces;
}

/** Splits each displayed field into pieces; with `revealed` false nothing is marked. */
export function highlightFields(message: Message, revealed: boolean): Record<Field, Piece[]> {
  const segments = fieldSegments(message);
  const ranges: Record<Field, Range[]> = { fromName: [], fromAddress: [], subject: [], body: [] };

  if (revealed) {
    message.highlights.forEach((h, index) => {
      if (!h.match) return;
      for (const field of FIELDS) {
        const start = segments[field].map(segmentText).join('').indexOf(h.match);
        if (start !== -1) {
          ranges[field].push({ index, start, end: start + h.match.length });
          break;
        }
      }
    });
  }

  return {
    fromName: toPieces(segments.fromName, ranges.fromName),
    fromAddress: toPieces(segments.fromAddress, ranges.fromAddress),
    subject: toPieces(segments.subject, ranges.subject),
    body: toPieces(segments.body, ranges.body),
  };
}
