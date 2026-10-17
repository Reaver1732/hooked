import { FLAG_LABELS } from '../../../shared/flags.ts';
import type { Message } from '../../../shared/messages.ts';
import { Badge } from './Badge.tsx';
import { CARD } from './buttonStyles.ts';
import { FlagIcon, ShieldCheckIcon } from './icons.tsx';

export function HighlightNotes({ message }: { message: Message }) {
  const tone = message.isPhish ? 'flag' : 'safe';
  return (
    <section aria-labelledby="notes-heading" className={`${CARD} p-4 sm:p-5`}>
      <h3 id="notes-heading" className="flex items-center gap-2 text-lg font-bold">
        <span
          className={`grid size-8 place-items-center rounded-lg ${message.isPhish ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}
        >
          {message.isPhish ? <FlagIcon className="size-5" /> : <ShieldCheckIcon className="size-5" />}
        </span>
        {message.isPhish ? 'Red flags' : 'Why it’s safe'}
      </h3>
      <ol role="list" className="mt-4 space-y-3">
        {message.highlights.map((h, i) => (
          <li key={i} className="flex gap-3">
            <Badge n={i + 1} tone={tone} className="mt-0.5" />
            <div className="text-sm leading-relaxed">
              {h.type && <p className="font-semibold text-slate-900">{FLAG_LABELS[h.type]}</p>}
              <p className="text-slate-700">{h.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
