import { useMemo } from 'react';
import type { Message } from '../../../shared/messages.ts';
import { highlightFields, type Piece } from '../game/highlights.ts';
import type { Tone } from './Badge.tsx';
import { HighlightedText } from './HighlightedText.tsx';
import { ArchiveIcon, ChevronLeftIcon, InboxIcon, SendIcon, SignalIcons, TrashIcon } from './icons.tsx';

type Props = { message: Message; revealed: boolean };

// App chrome (toolbars, status bars, compose boxes) is decorative and aria-hidden. It must
// stay neutral too: nothing like "Unknown sender" or "Message request" that hints at the answer.

export function MessageView({ message, revealed }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {message.context && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200">
          <span className="font-bold">Situation:</span> {message.context}
        </p>
      )}
      <MessageCard message={message} revealed={revealed} />
    </div>
  );
}

type CardProps = { message: Message; fields: Record<'fromName' | 'fromAddress' | 'subject' | 'body', Piece[]>; tone: Tone };

function MessageCard({ message, revealed }: Props) {
  const fields = useMemo(() => highlightFields(message, revealed), [message, revealed]);
  const tone = message.isPhish ? 'flag' : 'safe';
  if (message.kind === 'dm') return <ChatApp message={message} fields={fields} tone={tone} />;
  if (message.kind === 'text') return <PhoneApp message={message} fields={fields} tone={tone} />;
  return <MailApp message={message} fields={fields} tone={tone} />;
}

const initialOf = (name: string) => name.match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() ?? '?';

function MailApp({ message, fields, tone }: CardProps) {
  return (
    <article aria-label="Email" className="rounded-2xl border border-slate-300 bg-white shadow-md">
      <div
        aria-hidden
        className="flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-slate-100 px-4 py-2 text-slate-700"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <InboxIcon className="size-4" /> Inbox
        </span>
        <span className="flex gap-3">
          <ArchiveIcon className="size-4" />
          <TrashIcon className="size-4" />
        </span>
      </div>
      <header className="px-4 pt-4 pb-3 sm:px-6">
        <h3 className="text-xl leading-snug font-bold wrap-break-word">
          {fields.subject.length ? <HighlightedText pieces={fields.subject} tone={tone} /> : '(no subject)'}
        </h3>
        <div className="mt-3 flex items-start gap-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-100 font-bold text-indigo-800">
            {initialOf(message.from.name)}
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-slate-900 wrap-break-word">
              <span className="sr-only">From: </span>
              <HighlightedText pieces={fields.fromName} tone={tone} />
            </p>
            <p className="break-all text-slate-700">
              <HighlightedText pieces={fields.fromAddress} tone={tone} />
            </p>
            <p aria-hidden className="text-xs text-slate-600">
              to me
            </p>
          </div>
          <span aria-hidden className="shrink-0 text-xs text-slate-600">
            9:41 AM
          </span>
        </div>
      </header>
      <div className="border-t border-slate-100 px-4 pt-4 pb-6 leading-relaxed wrap-break-word whitespace-pre-line sm:px-6">
        <HighlightedText pieces={fields.body} tone={tone} />
      </div>
    </article>
  );
}

function PhoneApp({ fields, tone }: CardProps) {
  return (
    <article
      aria-label="Text message"
      className="mx-auto w-full max-w-sm rounded-[2.5rem] border-10 border-slate-900 bg-white shadow-xl"
    >
      <div aria-hidden className="flex items-center justify-between px-6 pt-2 pb-1 text-xs font-semibold text-slate-900">
        <span>9:41</span>
        <SignalIcons />
      </div>
      <header className="grid grid-cols-[2rem_1fr_2rem] items-start border-b border-slate-200 px-2 pt-1 pb-3">
        <ChevronLeftIcon className="mt-3 size-6 text-sky-700" />
        <div className="min-w-0 text-center">
          <div aria-hidden className="mx-auto mb-1 grid size-12 place-items-center rounded-full bg-linear-to-b from-slate-300 to-slate-400 text-white">
            <svg viewBox="0 0 24 24" className="size-8" fill="currentColor">
              <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z" />
            </svg>
          </div>
          <p className="text-sm font-semibold wrap-break-word">
            <span className="sr-only">From: </span>
            <HighlightedText pieces={fields.fromName} tone={tone} />
          </p>
          <p className="text-xs break-all text-slate-700">
            <HighlightedText pieces={fields.fromAddress} tone={tone} />
          </p>
        </div>
      </header>
      <div className="min-h-52 px-3 py-4">
        <p aria-hidden className="mb-3 text-center text-[11px] font-medium text-slate-600">
          Text Message · Today 9:41 AM
        </p>
        <div className="max-w-[85%] rounded-3xl rounded-bl-md bg-slate-200 px-4 py-2.5 leading-snug wrap-break-word whitespace-pre-line">
          <HighlightedText pieces={fields.body} tone={tone} />
        </div>
      </div>
      <div aria-hidden className="flex items-center gap-2 px-3 pb-5">
        <span className="flex-1 rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-600">Text Message</span>
        <span className="grid size-8 place-items-center rounded-full bg-slate-200 text-slate-600">
          <SendIcon className="size-4" />
        </span>
      </div>
    </article>
  );
}

function ChatApp({ message, fields, tone }: CardProps) {
  const initial = initialOf(message.from.name);
  const avatar = (size: string) => (
    <span aria-hidden className="shrink-0 rounded-full bg-linear-to-tr from-amber-400 via-pink-500 to-violet-600 p-0.5">
      <span className={`grid place-items-center rounded-full border-2 border-white bg-linear-to-br from-violet-600 to-fuchsia-700 font-semibold text-white ${size}`}>
        {initial}
      </span>
    </span>
  );
  return (
    <article aria-label="Direct message" className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-md">
      <header className="flex items-center gap-3 border-b border-slate-200 px-3 py-3">
        <ChevronLeftIcon className="size-6 shrink-0 text-slate-900" />
        {avatar('size-10 text-base')}
        <div className="min-w-0">
          <p className="font-bold wrap-break-word">
            <span className="sr-only">From: </span>
            <HighlightedText pieces={fields.fromName} tone={tone} />
          </p>
          <p className="text-sm break-all text-slate-700">
            <HighlightedText pieces={fields.fromAddress} tone={tone} />
          </p>
        </div>
      </header>
      <div className="min-h-44 px-3 py-5">
        <p aria-hidden className="mb-3 text-center text-[11px] font-medium text-slate-600">
          Today 9:41 AM
        </p>
        <div className="flex items-end gap-2">
          {avatar('size-7 text-xs')}
          <div className="max-w-[80%] rounded-3xl rounded-bl-md bg-slate-100 px-4 py-2.5 leading-snug wrap-break-word whitespace-pre-line">
            <HighlightedText pieces={fields.body} tone={tone} />
          </div>
        </div>
      </div>
      <div aria-hidden className="px-3 pb-4">
        <span className="flex items-center justify-between rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600">
          Message…
          <SendIcon className="size-4" />
        </span>
      </div>
    </article>
  );
}
