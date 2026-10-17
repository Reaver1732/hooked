import { useCallback, useEffect, useRef, useState } from 'react';
import { FOCUS_RING, PRIMARY_BUTTON } from '../components/buttonStyles.ts';
import { HighlightNotes } from '../components/HighlightNotes.tsx';
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

  const progress = ((index + (answered ? 1 : 0)) / deck.length) * 100;

  return (
    <section aria-labelledby="progress-heading" className="flex flex-col gap-5">
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="progress-heading" ref={headingRef} tabIndex={-1} className="text-sm font-medium text-slate-600 outline-none">
            <span className="sr-only">Message </span>
            {index + 1} of {deck.length}
          </h2>
          <p className="hidden text-xs text-slate-500 sm:block">
            Keys: <kbd className="font-sans font-semibold">P</kbd> phish · <kbd className="font-sans font-semibold">L</kbd> legit
            · <kbd className="font-sans font-semibold">Enter</kbd> next
          </p>
        </div>
        <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-slate-900 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <MessageView message={message} revealed={answered} />

      <div role="group" aria-label="Is this message a phish or legit?" className="grid grid-cols-2 gap-3">
        <AnswerButton label="Phish" shortcut="P" variant="phish" chosen={answer?.guessedPhish === true} disabled={answered} onClick={() => choose(true)} />
        <AnswerButton label="Legit" shortcut="L" variant="legit" chosen={answer?.guessedPhish === false} disabled={answered} onClick={() => choose(false)} />
      </div>

      <div aria-live="polite" aria-atomic="true">
        {answer && (
          <p
            className={`rounded-xl px-4 py-3 font-semibold ${isCorrect(answer) ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}
          >
            {isCorrect(answer) ? 'Correct!' : 'Incorrect.'}{' '}
            <span className="font-normal">This one is {message.isPhish ? 'a phish' : 'legit'}.</span>
          </p>
        )}
      </div>

      {answered && (
        <>
          <HighlightNotes message={message} />
          <button ref={nextRef} type="button" onClick={next} className={`${PRIMARY_BUTTON} self-end`}>
            {isLast ? 'See results' : 'Next'}
          </button>
        </>
      )}
    </section>
  );
}

const VARIANT_CLASSES = {
  phish: { base: 'border-red-300 bg-red-50 text-red-800 enabled:hover:bg-red-100', chosen: 'border-red-600 bg-red-600 text-white' },
  legit: { base: 'border-emerald-300 bg-emerald-50 text-emerald-800 enabled:hover:bg-emerald-100', chosen: 'border-emerald-600 bg-emerald-600 text-white' },
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
  const colors = VARIANT_CLASSES[variant];
  const state = chosen ? colors.chosen : disabled ? `${colors.base} opacity-40` : colors.base;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-keyshortcuts={shortcut}
      className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 px-3 text-xl font-bold disabled:cursor-default ${state} ${FOCUS_RING}`}
    >
      {label}
      <span className="text-xs font-medium opacity-80">
        {chosen ? 'Your answer' : <span className="hidden sm:inline">Press {shortcut}</span>}
      </span>
    </button>
  );
}
