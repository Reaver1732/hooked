import type { ReactNode } from 'react';
import { QUICK_ROUND_IDS } from '../../../shared/messages.ts';
import type { TeacherCredentials } from '../class/dashboardLink.ts';
import { FishIcon, FlagIcon, LockIcon, UsersIcon } from '../components/icons.tsx';
import { ReefScene } from '../design/art.tsx';
import { button, IconTile, RejoinNotice, SavedClasses, SessionLine, TeacherLinks, Wordmark } from '../design/parts.tsx';
import type { ClassSession } from './JoinScreen.tsx';
import { useStartScreen } from './useStartScreen.ts';

export type StartScreenProps = {
  session: ClassSession | null;
  onStart: () => void;
  /** Starts the 5-message quick round; left out while in a class (solo only). */
  onQuickStart?: () => void;
  onJoinClass: () => void;
  onLeaveClass: () => void;
  onTeacher: () => void;
  onTeacherGuide: () => void;
  onPasswordCheck: () => void;
  /** A new player's rejoin code, shown once until dismissed. */
  rejoinCode: string | null;
  onDismissRejoinCode: () => void;
  onOpenDashboard: (credentials: TeacherCredentials) => void;
};

export function StartScreen(props: StartScreenProps) {
  const { session, onStart, onQuickStart, onJoinClass, onLeaveClass, onTeacher, onTeacherGuide, onPasswordCheck } = props;
  const { rejoinCode, onDismissRejoinCode, onOpenDashboard } = props;
  const { joinRef, headingRef, rejoinRef, classes } = useStartScreen({ session, rejoinCode });

  return (
    <div className="flex flex-col gap-10 sm:gap-12">
      {rejoinCode && (
        <RejoinNotice
          code={rejoinCode}
          headingRef={rejoinRef}
          onDismiss={() => {
            onDismissRejoinCode();
            headingRef.current?.focus();
          }}
        />
      )}

      <section className="grid items-center gap-8 text-center lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-12 lg:text-left">
        <div className="flex flex-col items-center lg:items-start">
          <h1 ref={headingRef} tabIndex={-1} className="outline-none">
            <Wordmark size="lg" bob />
          </h1>
          <p className="hk-display mt-6 max-w-xl text-title text-primary">Spot the phish before it hooks you.</p>
          <p className="mt-3 max-w-xl text-ink-muted">
            Real-looking emails, texts, and DMs. Decide which are <strong className="text-ink">phish</strong> (scams made to
            trick you) and which are <strong className="text-ink">legit</strong> (real and safe). Then see the{' '}
            <strong className="text-ink">red flags</strong>: the warning signs you missed.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
            <button type="button" onClick={onStart} className={button('primary', 'xl')}>
              Start
              <span aria-hidden>→</span>
            </button>
            {onQuickStart && (
              <button type="button" onClick={onQuickStart} className={button('secondary', 'lg')}>
                Quick round ({QUICK_ROUND_IDS.length} messages)
              </button>
            )}
          </div>
          <p className="mt-4 text-small text-ink-muted">
            {session ? (
              <>
                You’ll play with class <span className="font-code font-bold text-ink">{session.code}</span>.
              </>
            ) : (
              'No account needed.'
            )}
          </p>
        </div>
        <figure>
          <ReefScene className="mx-auto w-full max-w-sm lg:max-w-none" />
          <figcaption className="mt-2 text-micro text-ink-muted">A lure dressed up as a message.</figcaption>
        </figure>
      </section>

      <ol className="grid gap-3 sm:grid-cols-3" aria-label="How to play">
        <Step n={1} icon={<FishIcon className="size-6" />} text="Read the message like it just landed." />
        <Step n={2} icon={<span aria-hidden className="hk-display text-heading leading-none">P/L</span>} text="Call it: Phish or Legit." />
        <Step n={3} icon={<FlagIcon className="size-6" />} text="See every red flag light up." />
      </ol>

      {session && <SessionLine session={session} onLeave={onLeaveClass} />}

      <div className="grid gap-6 sm:grid-cols-2">
        {!session && (
          <OptionCard icon={<UsersIcon className="size-7" />} tile="accent" title="In a class?" text="Join with the code your teacher shows.">
            <button ref={joinRef} type="button" onClick={onJoinClass} className={button('accent')}>
              Join a class
            </button>
          </OptionCard>
        )}
        <OptionCard icon={<LockIcon className="size-7" />} tile="mark" title="Password check" text="See whether a password has shown up in a data breach.">
          <button type="button" onClick={onPasswordCheck} className={button('accent')}>
            Check a password
          </button>
        </OptionCard>
      </div>

      {classes.length > 0 && <SavedClasses classes={classes} onOpen={onOpenDashboard} />}

      <TeacherLinks onTeacher={onTeacher} onTeacherGuide={onTeacherGuide} />
    </div>
  );
}

function Step({ n, icon, text }: { n: number; icon: ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-4 rounded-card bg-raised px-5 py-4">
      <span className="relative grid size-12 shrink-0 place-items-center rounded-chip bg-canvas text-accent">
        {icon}
        <span className="absolute -top-2 -left-2 grid size-6 place-items-center rounded-full bg-primary text-micro font-bold text-on-primary">
          <span className="sr-only">Step </span>
          {n}
        </span>
      </span>
      <span className="text-small font-bold text-ink">{text}</span>
    </li>
  );
}

type OptionCardProps = { icon: ReactNode; tile: 'accent' | 'mark'; title: string; text: string; children: ReactNode };

function OptionCard({ icon, tile, title, text, children }: OptionCardProps) {
  return (
    <div className="hk-card flex flex-col items-start gap-4 p-6">
      <IconTile tone={tile} size="lg">
        {icon}
      </IconTile>
      <div>
        <h2 className="hk-display text-title">{title}</h2>
        <p className="mt-1 text-card-ink-muted">{text}</p>
      </div>
      <div className="mt-auto pt-2">{children}</div>
    </div>
  );
}
