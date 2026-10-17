import { Fragment } from 'react';
import type { Message } from '../data/messages.ts';
import { parseBody } from '../data/linkTokens.ts';
import { FakeLink } from './FakeLink.tsx';

export function MessageBody({ message }: { message: Message }) {
  return (
    <p className="whitespace-pre-line">
      {parseBody(message.body).map((part, i) => {
        if (part.kind === 'text') return <Fragment key={i}>{part.text}</Fragment>;
        const link = message.links[part.index];
        return link ? <FakeLink key={i} link={link} /> : <Fragment key={i}>{part.raw}</Fragment>;
      })}
    </p>
  );
}
