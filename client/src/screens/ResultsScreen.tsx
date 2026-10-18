import { useEffect, useRef } from 'react';
import { FLAG_LABELS, mostMissedFlags } from '../../../shared/flags.ts';
import { button, CARD, SECONDARY_BUTTON } from '../components/buttonStyles.ts';
import { FishIcon, FlagIcon, LifebuoyIcon, ShieldCheckIcon } from '../components/icons.tsx';
import { isCorrect, type Answer } from '../game/types.ts';

type Props = {
  answers: Answer[];
  onPlayAgain: () => void;
  onPasswordCheck: () => void;
  /** Set when playing in a class. */
  classCode?: string;
};

function titleFor(score: number, total: number): string {
  const ratio = total ? score / total : 0;
  if (ratio === 1) return 'Perfect catch!';
  if (ratio >= 0.7) return 'Sharp eyes!';
  if (ratio >= 0.4) return 'Getting there.';
  return 'The phish got away this time.';
}

// Calm, practical steps for after a real phish; shown on every results screen.
const HOOKED_STEPS: [string, string][] = [
  ['Tell a trusted adult or your school’s IT team right away.', 'They’ve seen this before and can help.'],
  ['Change that password', 'by going to the real site or app yourself, not through the message.'],
  ['Turn on two-step verification', 'so a password alone isn’t enough to get in.'],
  ['Used that password anywhere else?', 'Change it there too.'],
];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function ResultsScreen({ answers, onPlayAgain, onPasswordCheck, classCode }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const score = answers.filter(isCorrect).length;
  const phish = answers.filter((a) => a.message.isPhish);
  const caught = phish.filter((a) => a.guessedPhish).length;
  const missedPhish = phish.filter((a) => !a.guessedPhish);
  const mostMissed = mostMissedFlags(answers);
  const legit = answers.filter((a) => !a.message.isPhish);
  const falseAlarms = legit.filter((a) => a.guessedPhish).length;

  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-5">
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-b from-sky-900 to-cyan-800 px-6 py-8 text-white shadow-lg sm:px-10">
        <FishIcon className="absolute -right-4 -bottom-3 hidden size-32 -rotate-12 text-sky-700/50 sm:block" />
        <h2 id="results-heading" ref={headingRef} tabIndex={-1} className="text-sm font-semibold tracking-wide text-sky-100 uppercase outline-none">
          Your score
        </h2>
        <p className="relative mt-1 text-7xl font-black tracking-tight">
          {score} <span className="text-sky-200">/</span> {answers.length}
        </p>
        <p className="relative mt-3 text-2xl font-bold text-amber-300">{titleFor(score, answers.length)}</p>
        <p className="relative mt-2 max-w-md text-lg text-sky-50">
          You caught {caught} of {phish.length} phish
          {legit.length > 0 &&
            ` and trusted ${legit.length - falseAlarms} of ${legit.length} legit ${plural(legit.length, 'message', 'messages')}`}
          .
        </p>
        {classCode && (
          <p className="relative mt-4 max-w-md text-sm text-sky-100">
            Your answers went to class <span className="font-mono font-semibold text-white">{classCode}</span>. Your best
            run counts for the class, so you can play again to try to beat it.
          </p>
        )}
      </div>

      <section aria-labelledby="missed-heading" className={`${CARD} p-4 sm:p-5`}>
        <h3 id="missed-heading" className="flex items-center gap-2 text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-red-100 text-red-700">
            <FlagIcon className="size-5" />
          </span>
          Most-missed red flags
        </h3>
        {mostMissed.length === 0 ? (
          <p className="mt-3 text-slate-700">
            {missedPhish.length === 0 ? 'None. You caught every phish.' : 'The phish you missed had no tagged red flags.'}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-700">
              Red flags in the {missedPhish.length} {plural(missedPhish.length, 'phish', 'phish')} you marked Legit.
            </p>
            <ol role="list" className="mt-3 divide-y divide-slate-100">
              {mostMissed.map(([type, count]) => (
                <li key={type} className="flex items-center justify-between gap-4 py-2.5">
                  <span>{FLAG_LABELS[type]}</span>
                  <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-800">
                    {count}
                    <span className="sr-only"> missed</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section aria-labelledby="false-alarms-heading" className={`${CARD} p-4 sm:p-5`}>
        <h3 id="false-alarms-heading" className="flex items-center gap-2 text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-800">
            <ShieldCheckIcon className="size-5" />
          </span>
          False alarms
        </h3>
        <p className="mt-3 text-slate-700">
          <span className="text-3xl font-black text-slate-900">{falseAlarms}</span> of {legit.length} legit{' '}
          {plural(legit.length, 'message', 'messages')} marked Phish.
        </p>
      </section>

      <section aria-labelledby="hooked-help-heading" className="rounded-2xl bg-sky-100/70 p-5 ring-1 ring-sky-200 sm:p-6">
        <h3 id="hooked-help-heading" className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <span className="grid size-8 place-items-center rounded-lg bg-white text-sky-800">
            <LifebuoyIcon className="size-5" />
          </span>
          If you ever do get hooked
        </h3>
        <p className="mt-2 text-sm text-slate-700">It happens to careful people too. Acting quickly keeps it small.</p>
        <ol className="mt-4 flex flex-col gap-3">
          {HOOKED_STEPS.map(([lead, rest], i) => (
            <li key={lead} className="flex gap-3 text-sm leading-relaxed text-slate-700">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sky-800 text-xs font-bold text-white">
                {i + 1}
              </span>
              <span>
                <strong className="text-slate-900">{lead}</strong> {rest}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onPlayAgain} className={button('primary', 'lg')}>
          Play again
        </button>
        <button type="button" onClick={onPasswordCheck} className={SECONDARY_BUTTON}>
          Check a password
        </button>
      </div>
    </section>
  );
}
