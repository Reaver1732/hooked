import { parseBody } from '../../../shared/linkTokens.ts';
import type { FakeLink, Message } from '../../../shared/messages.ts';

/** Every displayed text a highlight can land in, as rendered pieces. */
export type HighlightedFields = {
  fromName: Piece[];
  fromAddress: Piece[];
  subject: Piece[];
  body: Piece[];
  /** One entry per attachment name (emails only), in order. */
  attachments: Piece[][];
};

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

/** The searchable fields in a fixed order; each is a list of segments. */
function fieldSegments(message: Message): Segment[][] {
  const text = (t: string): Segment[] => [{ kind: 'text', text: t }];
  const isEmail = message.kind === 'email';
  return [
    text(message.from.name),
    text(message.from.address),
    isEmail && message.subject ? text(message.subject) : [],
    parseBody(message.body).map((p): Segment => {
      if (p.kind === 'text') return { kind: 'text', text: p.text };
      const link = message.links[p.index];
      return link ? { kind: 'link', link } : { kind: 'text', text: p.raw };
    }),
    ...(isEmail ? (message.attachments ?? []).map((a) => text(a.name)) : []),
  ];
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
export function highlightFields(message: Message, revealed: boolean): HighlightedFields {
  const fields = fieldSegments(message);
  const ranges: Range[][] = fields.map(() => []);

  if (revealed) {
    message.highlights.forEach((h, index) => {
      if (!h.match) return;
      for (let f = 0; f < fields.length; f++) {
        const start = fields[f].map(segmentText).join('').indexOf(h.match);
        if (start !== -1) {
          ranges[f].push({ index, start, end: start + h.match.length });
          break;
        }
      }
    });
  }

  const [fromName, fromAddress, subject, body, ...attachments] = fields.map((segments, f) => toPieces(segments, ranges[f]));
  return { fromName, fromAddress, subject, body, attachments };
}
