import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from '../../../shared/messages.ts';
import { isCorrect, type Answer } from './types.ts';

export type PlayStateOptions = {
  deck: Message[];
  onFinish: (answers: Answer[]) => void;
  /** Called once per message when it's first answered (used to report to a class). */
  onAnswer?: (answer: Answer) => void;
  /** Answers already given to the first messages (resuming a class attempt). */
  initialAnswers?: Answer[];
  /** Whether P and L answer (they can be turned off; Enter for Next always works). */
  letterShortcuts?: boolean;
  /** The class already had a different answer for this message; show that one instead. */
  correction?: { messageId: string; guessedPhish: boolean; seq: number } | null;
};

/**
 * Everything the play screen does (state, keyboard shortcuts, focus moves), separate from
 * how it looks, so every visual design shares exactly the same behavior.
 */
// The play screen's two-column breakpoint (Tailwind's lg, as used in PlayScreen).
const TWO_COLUMNS = '(min-width: 64rem)';

export function usePlayState({ deck, onFinish, onAnswer, initialAnswers = [], letterShortcuts = true, correction = null }: PlayStateOptions) {
  const [index, setIndex] = useState(initialAnswers.length);
  const [answers, setAnswers] = useState<Answer[]>(initialAnswers);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const verdictRef = useRef<HTMLDivElement>(null);
  // Guards against two answers for one message (e.g. P then L before a re-render).
  const lastAnsweredRef = useRef(initialAnswers.length - 1);

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

  useEffect(() => {
    if (!correction) return;
    setAnswers((list) =>
      list.map((a) => (a.message.id === correction.messageId ? { ...a, guessedPhish: correction.guessedPhish } : a)),
    );
  }, [correction]);

  // New message: start at the top and put focus on the progress heading.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  // Answered. In the one-column layout (phones, small tablets) the verdict lands below the screen,
  // so bring it to the top: instantly, which also respects reduced motion. Then hand focus to Next
  // (the answer buttons are now disabled) without scrolling away from the verdict.
  useEffect(() => {
    if (!answered) return;
    if (!window.matchMedia(TWO_COLUMNS).matches) verdictRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    nextRef.current?.focus({ preventScroll: true });
  }, [answered]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (letterShortcuts && !answered && (key === 'p' || key === 'l')) {
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
  }, [answered, choose, next, letterShortcuts]);


  const verdict = answer && verdictFor(isCorrect(answer), message.isPhish);

  return { index, answers, message, answer, answered, isLast, choose, next, headingRef, nextRef, verdictRef, verdict };
}

export function verdictFor(correct: boolean, isPhish: boolean) {
  if (correct) {
    return isPhish
      ? { correct, headline: 'Correct! Nice catch.', detail: 'That one was a phish.' }
      : { correct, headline: 'Correct!', detail: 'That one was legit.' };
  }
  return isPhish
    ? { correct, headline: 'Incorrect. You got hooked.', detail: 'That one was a phish.' }
    : { correct, headline: 'Incorrect. False alarm.', detail: 'That one was legit.' };
}
