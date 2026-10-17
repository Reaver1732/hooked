import { useCallback, useEffect, useRef, useState } from 'react';
import { button, FOCUS_RING } from '../components/buttonStyles.ts';
import { HighlightNotes } from '../components/HighlightNotes.tsx';
import { CheckCircleIcon, FishIcon, ShieldCheckIcon, XCircleIcon } from '../components/icons.tsx';
import { MessageView } from '../components/MessageView.tsx';
import type { Message } from '../../../shared/messages.ts';
import { isCorrect, type Answer } from '../game/types.ts';

type Props = {
  deck: Message[];
  onFinish: (answers: Answer[]) => void;
  /** Called once per message when it's first answered (used to report to a class). */
  onAnswer?: (answer: Answer) => void;
};

export function PlayScreen({ deck, onFinish, onAnswer }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  // Guards against two answers for one message (e.g. P then L before a re-render).
  const lastAnsweredRef = useRef(-1);

  const message = deck[index];
  const answer: Answer | undefined = answers[index];
  const answered = answer !== undefined;
  const isLast = index === deck.length - 1;

  const choose = useCallback(
    (guessedPhish: boolean) => {
      if (lastAnsweredRef.current >= index) return;
      lastAnsweredRef.current = index;
      const newAnswer = { message, guessedPhish };
      setAnswers((prev) => [...prev, newAnswer]);
      onAnswer?.(newAnswer);
    },
    [index, message, onAnswer],
  );

  const next = useCallback(() => {
    if (isLast) onFinish(answers);
    else setIndex((i) => i + 1);
  }, [isLast, onFinish, answers]);

  // New message: start at the top and put focus on the progress heading.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  // Answered: the answer buttons are now disabled, so hand focus to Next.
  useEffect(() => {
    if (answered) nextRef.current?.focus({ preventScroll: true });
  }, [answered]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (!answered && (key === 'p' || key === 'l')) {
        e.preventDefault();
        choose(key === 'p');
      } else if (answered && key === 'enter' && !e.repeat) {
        // Let a focused button (e.g. Next itself) handle its own Enter.
        if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea')) return;
        e.preventDefault();
        next();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [answered, choose, next]);


  const verdict = answer && verdictFor(isCorrect(answer), message.isPhish);

  return (
    <section aria-labelledby="progress-heading" className="flex flex-col gap-5">
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="progress-heading" ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-slate-700 outline-none">
            <span className="sr-only">Message </span>
            {index + 1} of {deck.length}
          </h2>
          <p className="hidden text-xs text-slate-700 sm:block">
            Keys: <kbd className="font-sans font-bold">P</kbd> phish · <kbd className="font-sans font-bold">L</kbd> legit ·{' '}
            <kbd className="font-sans font-bold">Enter</kbd> next
          </p>
        </div>
        {/* One segment per message: green/red once answered, light blue for the current one. */}
        <ol aria-hidden className="mt-2 flex gap-1">
          {deck.map((m, i) => {
            const a = answers[i];
            const color = a ? (isCorrect(a) ? 'bg-emerald-600' : 'bg-red-600') : i === index ? 'bg-sky-400' : 'bg-slate-200';
            return <li key={m.id} className={`h-2 flex-1 rounded-full ${color}`} />;
          })}
        </ol>
      </div>

      <MessageView message={message} revealed={answered} />

      <div role="group" aria-label="Is this message a phish or legit?" className="grid grid-cols-2 gap-3">
        <AnswerButton label="Phish" shortcut="P" variant="phish" chosen={answer?.guessedPhish === true} disabled={answered} onClick={() => choose(true)} />
        <AnswerButton label="Legit" shortcut="L" variant="legit" chosen={answer?.guessedPhish === false} disabled={answered} onClick={() => choose(false)} />
      </div>

      <div aria-live="polite" aria-atomic="true">
        {verdict && (
          <p
            className={`flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 ${verdict.correct ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-red-50 text-red-900 ring-red-200'}`}
          >
            {verdict.correct ? <CheckCircleIcon className="mt-0.5 size-6 shrink-0" /> : <XCircleIcon className="mt-0.5 size-6 shrink-0" />}
            <span>
              <span className="block text-lg font-bold">{verdict.headline}</span>
              {verdict.detail}
            </span>
          </p>
        )}
      </div>

      {answered && (
        <>
          <HighlightNotes message={message} />
          <button ref={nextRef} type="button" onClick={next} className={`${button('primary', 'lg')} self-end`}>
            {isLast ? 'See results' : 'Next'}
            <span aria-hidden>→</span>
          </button>
        </>
      )}
    </section>
  );
}

function verdictFor(correct: boolean, isPhish: boolean) {
  if (correct) {
    return isPhish
      ? { correct, headline: 'Correct! Nice catch.', detail: 'That one was a phish.' }
      : { correct, headline: 'Correct!', detail: 'That one was legit.' };
  }
  return isPhish
    ? { correct, headline: 'Incorrect. You got hooked.', detail: 'That one was a phish.' }
    : { correct, headline: 'Incorrect. False alarm.', detail: 'That one was legit.' };
}

const VARIANT_CLASSES = {
  phish: {
    base: 'border-red-300 bg-red-50 text-red-800 enabled:hover:bg-red-100',
    chosen: 'border-red-700 bg-red-700 text-white',
    icon: FishIcon,
  },
  legit: {
    base: 'border-emerald-300 bg-emerald-50 text-emerald-800 enabled:hover:bg-emerald-100',
    chosen: 'border-emerald-700 bg-emerald-700 text-white',
    icon: ShieldCheckIcon,
  },
};

type AnswerButtonProps = {
  label: string;
  shortcut: string;
  variant: keyof typeof VARIANT_CLASSES;
  chosen: boolean;
  disabled: boolean;
  onClick: () => void;
};

function AnswerButton({ label, shortcut, variant, chosen, disabled, onClick }: AnswerButtonProps) {
  const { base, chosen: chosenClasses, icon: Icon } = VARIANT_CLASSES[variant];
  // Unchosen buttons fade once answered; disabled controls are exempt from contrast rules.
  const state = chosen ? chosenClasses : disabled ? `${base} opacity-40` : base;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-keyshortcuts={shortcut}
      className={`flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-3 text-xl font-bold shadow-sm disabled:cursor-default disabled:shadow-none ${state} ${FOCUS_RING}`}
    >
      <span className="flex items-center gap-2">
        <Icon className="size-6" />
        {label}
      </span>
      <span className="text-xs font-medium">
        {chosen ? 'Your answer' : <span className="hidden sm:inline">Press {shortcut}</span>}
      </span>
    </button>
  );
}
