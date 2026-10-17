import { useEffect, useRef } from 'react';
import { PRIMARY_BUTTON } from '../components/buttonStyles.ts';
import { FLAG_LABELS } from '../data/flags.ts';
import type { FlagType } from '../data/messages.ts';
import { isCorrect, type Answer } from '../game/types.ts';

type Props = { answers: Answer[]; onPlayAgain: () => void };

export function ResultsScreen({ answers, onPlayAgain }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const score = answers.filter(isCorrect).length;

  const missedPhish = answers.filter((a) => a.message.isPhish && !a.guessedPhish);
  const flagCounts = new Map<FlagType, number>();
  for (const a of missedPhish) {
    for (const h of a.message.highlights) {
      if (h.type) flagCounts.set(h.type, (flagCounts.get(h.type) ?? 0) + 1);
    }
  }
  const mostMissed = [...flagCounts].sort(
    ([typeA, countA], [typeB, countB]) => countB - countA || FLAG_LABELS[typeA].localeCompare(FLAG_LABELS[typeB]),
  );

  const legitTotal = answers.filter((a) => !a.message.isPhish).length;
  const falseAlarms = answers.filter((a) => !a.message.isPhish && a.guessedPhish).length;

  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-8">
      <div>
        <h2 id="results-heading" ref={headingRef} tabIndex={-1} className="text-sm font-medium text-slate-600 outline-none">
          Your score
        </h2>
        <p className="mt-1 text-6xl font-bold tracking-tight">
          {score} / {answers.length}
        </p>
      </div>

      <section aria-labelledby="missed-heading" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 id="missed-heading" className="text-lg font-semibold">
          Most-missed red flags
        </h3>
        {mostMissed.length === 0 ? (
          <p className="mt-2 text-slate-600">
            {missedPhish.length === 0 ? 'None. You caught every phish.' : 'The phish you missed had no tagged red flags.'}
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Red flags in the {missedPhish.length} {missedPhish.length === 1 ? 'phish' : 'phishes'} you marked Legit.
            </p>
            <ol role="list" className="mt-3 divide-y divide-slate-100">
              {mostMissed.map(([type, count]) => (
                <li key={type} className="flex items-center justify-between gap-4 py-2">
                  <span>{FLAG_LABELS[type]}</span>
                  <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-semibold text-red-800">
                    {count}
                    <span className="sr-only"> missed</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section aria-labelledby="false-alarms-heading" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 id="false-alarms-heading" className="text-lg font-semibold">
          False alarms
        </h3>
        <p className="mt-2 text-slate-600">
          <span className="text-2xl font-bold text-slate-900">{falseAlarms}</span> of {legitTotal} legit{' '}
          {legitTotal === 1 ? 'message' : 'messages'} marked Phish.
        </p>
      </section>

      <button type="button" onClick={onPlayAgain} className={`${PRIMARY_BUTTON} self-start`}>
        Play again
      </button>
    </section>
  );
}
