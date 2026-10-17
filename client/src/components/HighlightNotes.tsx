import { FLAG_LABELS } from '../data/flags.ts';
import type { Message } from '../data/messages.ts';
import { Badge } from './Badge.tsx';

export function HighlightNotes({ message }: { message: Message }) {
  const tone = message.isPhish ? 'flag' : 'safe';
  return (
    <section aria-labelledby="notes-heading">
      <h3 id="notes-heading" className="text-base font-semibold">
        {message.isPhish ? 'Red flags' : 'Why it’s safe'}
      </h3>
      <ol role="list" className="mt-3 space-y-3">
        {message.highlights.map((h, i) => (
          <li key={i} className="flex gap-3">
            <Badge n={i + 1} tone={tone} className="mt-0.5" />
            <div className="text-sm leading-relaxed">
              {h.type && <p className="font-medium text-slate-900">{FLAG_LABELS[h.type]}</p>}
              <p className="text-slate-700">{h.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
