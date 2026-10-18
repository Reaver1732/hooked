import { useMemo } from 'react';
import { MessageView } from '../components/MessageView.tsx';
import { AnswerButtons, KeysHint, NextButton, Notes, Situation, Verdict } from '../design/parts.tsx';
import { isCorrect } from '../game/types.ts';
import { usePlayState, type PlayStateOptions } from '../game/usePlayState.ts';

export function PlayScreen(props: PlayStateOptions) {
  const { deck } = props;
  const { index, answers, message, answer, answered, isLast, choose, next, headingRef, nextRef, verdict } = usePlayState(props);
  const correctSoFar = answers.filter(isCorrect).length;
  // The situation line is drawn here, so the message card renders without it.
  const card = useMemo(() => ({ ...message, context: undefined }), [message]);

  return (
    <section aria-labelledby="progress-heading" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-10">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="rounded-card bg-raised px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <h2 id="progress-heading" ref={headingRef} tabIndex={-1} className="hk-display text-heading outline-none">
              Message {index + 1} <span className="text-ink-muted">of {deck.length}</span>
            </h2>
            <p className="rounded-full bg-canvas px-3 py-1 text-small font-bold text-accent">{correctSoFar} correct</p>
          </div>
          {/* Phones: one chunky bar. Wider: a pill per message, colored once answered. */}
          <div aria-hidden className="mt-3 h-3 overflow-hidden rounded-full bg-track sm:hidden">
            <div className="hk-fill h-full rounded-full bg-fill" style={{ width: `${(answers.length / deck.length) * 100}%` }} />
          </div>
          <ol aria-hidden className="mt-3 hidden gap-2 sm:flex">
            {deck.map((m, i) => {
              const a = answers[i];
              const color = a ? (isCorrect(a) ? 'bg-good' : 'bg-bad') : i === index ? 'bg-primary' : 'bg-track';
              return <li key={m.id} className={`h-3 flex-1 rounded-full ${color}`} />;
            })}
          </ol>
        </div>

        {message.context && <Situation text={message.context} />}

        {/* The message keeps a neutral system font so it still looks like the app it came from. */}
        <div className="hk-marks font-message text-card-ink">
          <MessageView message={card} revealed={answered} />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <AnswerButtons answer={answer} onChoose={choose} />
        <KeysHint />
        <Verdict verdict={verdict} />
        {answered && (
          <>
            <Notes message={message} />
            <div className="flex justify-end">
              <NextButton buttonRef={nextRef} isLast={isLast} onNext={next} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
