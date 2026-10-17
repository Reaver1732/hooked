import { Fragment } from 'react';
import type { Piece } from '../game/highlights.ts';
import { Badge, type Tone } from './Badge.tsx';
import { FakeLink } from './FakeLink.tsx';

const MARK_CLASSES: Record<Tone, string> = {
  flag: 'bg-red-100 ring-red-300',
  safe: 'bg-emerald-100 ring-emerald-300',
};

export function HighlightedText({ pieces, tone }: { pieces: Piece[]; tone: Tone }) {
  return pieces.map((piece, i) => {
    const content = piece.kind === 'text' ? piece.text : <FakeLink link={piece.link} />;
    if (!piece.marked) return <Fragment key={i}>{content}</Fragment>;
    // A marked link is one unit: keep its badge from wrapping away from it.
    const linkUnit = piece.kind === 'link' ? 'inline-block whitespace-nowrap' : '';
    return (
      <mark key={i} className={`rounded px-0.5 text-inherit ring-1 box-decoration-clone ${linkUnit} ${MARK_CLASSES[tone]}`}>
        {piece.badges.map((index) => (
          <Badge key={index} n={index + 1} tone={tone} className="mr-0.5 size-4 align-text-top text-[10px]" />
        ))}
        {content}
      </mark>
    );
  });
}
