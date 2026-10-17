import { useMemo } from 'react';
import type { Message } from '../data/messages.ts';
import { highlightFields } from '../game/highlights.ts';
import { HighlightedText } from './HighlightedText.tsx';

export function MessageView({ message, revealed }: { message: Message; revealed: boolean }) {
  const fields = useMemo(() => highlightFields(message, revealed), [message, revealed]);
  const tone = message.isPhish ? 'flag' : 'safe';

  if (message.kind === 'text') {
    return (
      <article
        aria-label="Text message"
        className="mx-auto w-full max-w-sm rounded-[2rem] border-[6px] border-slate-800 bg-white shadow-sm"
      >
        <header className="border-b border-slate-200 px-4 pt-4 pb-3 text-center">
          <div aria-hidden className="mx-auto mb-1.5 grid size-11 place-items-center rounded-full bg-slate-300 text-white">
            <svg viewBox="0 0 24 24" className="size-7" fill="currentColor">
              <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z" />
            </svg>
          </div>
          <p className="font-semibold break-words">
            <span className="sr-only">From: </span>
            <HighlightedText pieces={fields.fromName} tone={tone} />
          </p>
          <p className="text-sm break-all text-slate-500">
            <HighlightedText pieces={fields.fromAddress} tone={tone} />
          </p>
        </header>
        <div className="min-h-48 px-3 py-5">
          <p className="mb-2 text-center text-[11px] text-slate-400">Text Message · Today</p>
          <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-slate-200 px-3.5 py-2.5 leading-snug break-words whitespace-pre-line">
            <HighlightedText pieces={fields.body} tone={tone} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article aria-label="Email" className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <h3 className="text-lg leading-snug font-semibold break-words">
          {fields.subject.length ? <HighlightedText pieces={fields.subject} tone={tone} /> : '(no subject)'}
        </h3>
        <p className="mt-2 text-sm">
          <span className="text-slate-500">From: </span>
          <span className="font-medium break-words">
            <HighlightedText pieces={fields.fromName} tone={tone} />
          </span>{' '}
          <span className="break-all text-slate-600">
            &lt;
            <HighlightedText pieces={fields.fromAddress} tone={tone} />
            &gt;
          </span>
        </p>
      </header>
      <div className="px-4 py-4 leading-relaxed break-words whitespace-pre-line sm:px-5">
        <HighlightedText pieces={fields.body} tone={tone} />
      </div>
    </article>
  );
}
