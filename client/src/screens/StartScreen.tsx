import { useEffect, useRef, type ReactNode } from 'react';
import { button, CARD, FOCUS_RING, SECONDARY_BUTTON } from '../components/buttonStyles.ts';
import { FishIcon, LockIcon, UsersIcon } from '../components/icons.tsx';
import { Logo } from '../components/Logo.tsx';
import type { ClassSession } from './JoinScreen.tsx';

type Props = {
  session: ClassSession | null;
  onStart: () => void;
  onJoinClass: () => void;
  onLeaveClass: () => void;
  onTeacher: () => void;
  onPasswordCheck: () => void;
};

export function StartScreen({ session, onStart, onJoinClass, onLeaveClass, onTeacher, onPasswordCheck }: Props) {
  const joinRef = useRef<HTMLButtonElement>(null);
  const hadSession = useRef(session !== null);

  // "Leave class" removes itself, so hand focus to the "Join a class" button that replaces it.
  useEffect(() => {
    if (hadSession.current && !session) joinRef.current?.focus();
    hadSession.current = session !== null;
  }, [session]);

  return (
    <section className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-b from-sky-900 via-sky-800 to-cyan-800 px-6 pt-10 pb-28 text-white shadow-lg sm:px-10 sm:pt-12">
        <h1 tabIndex={-1} className="outline-none">
          <Logo size="lg" tone="dark" bob />
        </h1>
        <p className="mt-5 max-w-md text-2xl leading-snug font-bold">Spot the phish before it hooks you.</p>
        <p className="mt-3 max-w-md text-sky-100">
          Real-looking emails, texts, and DMs. Decide which are phish and which are legit, then see the red flags you
          missed.
        </p>
        <button type="button" onClick={onStart} className={`${button('primaryOnDark', 'lg')} mt-7`}>
          Start
        </button>
        {session && (
          <p className="mt-3 text-sm text-sky-100">
            You’ll play with class <span className="font-mono font-semibold text-white">{session.code}</span>.
          </p>
        )}
        <Waves />
      </div>

      {session && (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          Playing in class <span className="font-mono font-semibold">{session.code}</span> as{' '}
          <strong>{session.nickname}</strong>.{' '}
          <button type="button" onClick={onLeaveClass} className={`rounded-sm font-medium underline ${FOCUS_RING}`}>
            Leave class
          </button>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {!session && (
          <OptionCard icon={<UsersIcon className="size-6" />} title="In a class?" text="Join with the code your teacher shows.">
            <button ref={joinRef} type="button" onClick={onJoinClass} className={SECONDARY_BUTTON}>
              Join a class
            </button>
          </OptionCard>
        )}
        <OptionCard
          icon={<LockIcon className="size-6" />}
          title="Password check"
          text="See whether a password has shown up in a data breach."
        >
          <button type="button" onClick={onPasswordCheck} className={SECONDARY_BUTTON}>
            Check a password
          </button>
        </OptionCard>
      </div>

      <p className="text-center text-sm text-slate-700">
        Teaching this?{' '}
        <button type="button" onClick={onTeacher} className={`rounded-sm font-semibold text-sky-900 underline ${FOCUS_RING}`}>
          I’m a teacher
        </button>
      </p>
    </section>
  );
}

function OptionCard({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <div className={`${CARD} flex flex-col items-start gap-3 p-5`}>
      <span className="grid size-11 place-items-center rounded-xl bg-sky-100 text-sky-800">{icon}</span>
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-slate-700">{text}</p>
      </div>
      <div className="mt-auto pt-1">{children}</div>
    </div>
  );
}

/** Decorative sea at the bottom of the hero. */
function Waves() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24">
      <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-20 w-full">
        <path d="M0 22c50-16 100-16 150 0s100 16 150 0 70-12 100-4v42H0Z" className="fill-sky-700/60" />
        <path d="M0 36c60-14 110-12 160 2s110 14 160 0 60-8 80-4v26H0Z" className="fill-cyan-900/70" />
      </svg>
      <FishIcon className="absolute bottom-6 left-[12%] size-7 text-sky-300/70" />
      <FishIcon className="absolute bottom-3 left-[30%] size-5 -scale-x-100 text-sky-300/50" />
      <FishIcon className="absolute right-[18%] bottom-5 size-6 text-amber-300/80" />
    </div>
  );
}
