import { useEffect, useRef } from 'react';
import { FLAG_LABELS, mostMissedFlags } from '../../../shared/flags.ts';
import { FishIcon, FlagIcon, LifebuoyIcon, ShieldCheckIcon } from '../components/icons.tsx';
import { button, IconTile, StepNumber } from '../design/parts.tsx';
import { isCorrect, type Answer } from '../game/types.ts';

type Props = {
  answers: Answer[];
  onPlayAgain: () => void;
  onPasswordCheck: () => void;
  /** Set when playing in a class and this round's answers reached it. */
  classCode?: string;
  /** Some of this round's answers are still on their way to the class. */
  classSaving?: boolean;
  /** This was the 5-message quick round; offers the full game instead of a replay. */
  quick?: boolean;
  /** How many messages the full game has. */
  totalMessages: number;
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
  ['Tell a parent, teacher, or your school’s tech help team', 'right away.'],
  ['Typed a password into a fake page? Change it.', 'Open the real app or website yourself, not the link in the message.'],
  ['Turn on two-step verification.', 'Then logging in also needs a code from your phone, so a stolen password isn’t enough.'],
  ['Used that password anywhere else?', 'Change it there too.'],
];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function ResultsScreen(props: Props) {
  const { answers, onPlayAgain, onPasswordCheck, classCode, classSaving = false, quick = false, totalMessages } = props;
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
    <section aria-labelledby="results-heading" className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-card bg-raised px-6 py-8 sm:px-10">
        <FishIcon className="hk-bob absolute -right-4 -bottom-4 hidden size-36 text-accent-soft sm:block" />
        <h2 id="results-heading" ref={headingRef} tabIndex={-1} className="text-micro font-bold tracking-wide text-ink-muted uppercase outline-none">
          Your score
        </h2>
        <p className="hk-display relative mt-1 text-display">
          {score} <span className="text-ink-muted">/</span> {answers.length}
        </p>
        <p className="hk-display relative mt-3 text-title text-primary">{titleFor(score, answers.length)}</p>
        <p className="relative mt-2 max-w-xl text-ink">
          You caught {caught} of {phish.length} phish
          {legit.length > 0 &&
            ` and trusted ${legit.length - falseAlarms} of ${legit.length} legit ${plural(legit.length, 'message', 'messages')}`}
          .
        </p>
        {quick && (
          <p className="relative mt-4 max-w-xl text-small text-ink-muted">
            That was the quick round: {answers.length} of the {totalMessages} messages. Play all {totalMessages} to see more
            tricks scammers use.
          </p>
        )}
        {classCode && classSaving && (
          <p className="relative mt-4 max-w-xl text-small text-ink-muted">
            Sending your last answers to class <span className="font-code font-bold text-ink">{classCode}</span>…
          </p>
        )}
        {classCode && !classSaving && (
          <p className="relative mt-4 max-w-xl text-small text-ink-muted">
            Your answers went to class <span className="font-code font-bold text-ink">{classCode}</span>. Your teacher sees
            your first score and your best one. Play again to try to beat your best.
          </p>
        )}
        <div className="relative mt-6 flex flex-wrap gap-4">
          <button type="button" onClick={onPlayAgain} className={button('primary', 'lg')}>
            {quick ? `Play all ${totalMessages}` : 'Play again'}
          </button>
          <button type="button" onClick={onPasswordCheck} className={button('secondary', 'lg')}>
            Check a password
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <section aria-labelledby="missed-heading" className="hk-card p-5 sm:p-6">
          <h3 id="missed-heading" className="hk-display flex items-center gap-3 text-heading">
            <IconTile tone="mark">
              <FlagIcon className="size-6" />
            </IconTile>
            Most-missed red flags
          </h3>
          {mostMissed.length === 0 ? (
            <p className="mt-4 text-card-ink-muted">
              {missedPhish.length === 0 ? 'None. You caught every phish.' : 'The phish you missed had no tagged red flags.'}
            </p>
          ) : (
            <>
              <p className="mt-3 text-small text-card-ink-muted">
                Red flags in the {missedPhish.length} {plural(missedPhish.length, 'phish', 'phish')} you marked Legit.
              </p>
              <ol role="list" className="mt-2 divide-y divide-line">
                {mostMissed.map(([type, count]) => (
                  <li key={type} className="flex items-center justify-between gap-4 py-3">
                    <span>{FLAG_LABELS[type]}</span>
                    <span className="shrink-0 rounded-full bg-bad px-3 py-0.5 text-small font-bold text-on-bad">
                      {count}
                      <span className="sr-only"> missed</span>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        <section aria-labelledby="false-alarms-heading" className="hk-card p-5 sm:p-6">
          <h3 id="false-alarms-heading" className="hk-display flex items-center gap-3 text-heading">
            <IconTile>
              <ShieldCheckIcon className="size-6" />
            </IconTile>
            False alarms
          </h3>
          <p className="mt-4 text-card-ink-muted">
            <span className="hk-display text-title text-card-ink">{falseAlarms}</span> of {legit.length} legit{' '}
            {plural(legit.length, 'message', 'messages')} marked Phish.
          </p>
        </section>
      </div>

      <section aria-labelledby="hooked-help-heading" className="rounded-card bg-raised p-5 sm:p-6">
        <h3 id="hooked-help-heading" className="hk-display flex items-center gap-3 text-heading">
          <IconTile tone="primary">
            <LifebuoyIcon className="size-6" />
          </IconTile>
          If you ever do get hooked
        </h3>
        <p className="mt-3 text-small text-ink-muted">It happens to careful people too. Acting quickly keeps it small.</p>
        <ol className="mt-4 grid gap-4 md:grid-cols-2">
          {HOOKED_STEPS.map(([lead, rest], i) => (
            <li key={lead} className="flex gap-3 text-small text-ink-muted">
              <StepNumber n={i + 1} />
              <span>
                <strong className="text-ink">{lead}</strong> {rest}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
