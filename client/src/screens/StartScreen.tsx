import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiRequestError } from '../class/api.ts';
import type { TeacherCredentials } from '../class/dashboardLink.ts';
import { forgetClass, storedClasses, type StoredClass } from '../class/storage.ts';
import { button, CARD, FOCUS_RING, SECONDARY_BUTTON } from '../components/buttonStyles.ts';
import { ChalkboardIcon, FishIcon, LockIcon, UsersIcon } from '../components/icons.tsx';
import { Logo } from '../components/Logo.tsx';
import type { ClassSession } from './JoinScreen.tsx';

type Props = {
  session: ClassSession | null;
  onStart: () => void;
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

export function StartScreen(props: Props) {
  const { session, onStart, onJoinClass, onLeaveClass, onTeacher, onTeacherGuide, onPasswordCheck } = props;
  const { rejoinCode, onDismissRejoinCode, onOpenDashboard } = props;
  const joinRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rejoinRef = useRef<HTMLHeadingElement>(null);
  const hadSession = useRef(session !== null);
  const [classes, setClasses] = useState<StoredClass[]>(storedClasses);

  // Classes created on this browser: drop any the server says are gone (deleted or expired).
  useEffect(() => {
    let cancelled = false;
    for (const { code } of storedClasses()) {
      api.classStatus(code).catch((err) => {
        if (cancelled || !(err instanceof ApiRequestError) || err.status !== 404) return;
        forgetClass(code);
        setClasses((list) => list.filter((c) => c.code !== code));
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // A fresh rejoin code is the first thing to read (and hear) after joining.
  useEffect(() => {
    if (rejoinCode) rejoinRef.current?.focus();
  }, [rejoinCode]);

  // "Leave class" removes itself, so hand focus to the "Join a class" button that replaces it.
  useEffect(() => {
    if (hadSession.current && !session) joinRef.current?.focus();
    hadSession.current = session !== null;
  }, [session]);

  return (
    <section className="flex flex-col gap-4">
      {rejoinCode && (
        <section aria-labelledby="rejoin-code-heading" className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-5">
          <h2 id="rejoin-code-heading" ref={rejoinRef} tabIndex={-1} className="text-lg font-bold text-amber-950 outline-none">
            Your rejoin code: <span className="sr-only">{rejoinCode.split('').join(' ')}</span>
            <span aria-hidden className="ml-1 font-mono text-2xl tracking-[0.2em]">
              {rejoinCode}
            </span>
          </h2>
          <p className="mt-1 text-sm text-amber-950">
            Write it down to keep playing on another device. It’s shown only once.
          </p>
          <button
            type="button"
            onClick={() => {
              onDismissRejoinCode();
              headingRef.current?.focus();
            }}
            className={`${button('secondary', 'sm')} mt-3`}
          >
            I wrote it down
          </button>
        </section>
      )}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-b from-sky-900 via-sky-800 to-cyan-800 px-6 pt-10 pb-28 text-white shadow-lg sm:px-10 sm:pt-12">
        <h1 ref={headingRef} tabIndex={-1} className="outline-none">
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

      {classes.length > 0 && (
        <section aria-labelledby="my-classes-heading" className={`${CARD} p-5`}>
          <h2 id="my-classes-heading" className="flex items-center gap-2 text-lg font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-sky-100 text-sky-800">
              <ChalkboardIcon className="size-5" />
            </span>
            Your classes on this device
          </h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {classes.map((c) => (
              <li key={c.code} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span>
                  <span className="font-mono text-lg font-bold tracking-wider text-sky-900">{c.code}</span>
                  <span className="ml-2 text-sm text-slate-700">
                    created {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenDashboard({ code: c.code, teacherKey: c.teacherKey })}
                  aria-label={`Open dashboard for class ${c.code}`}
                  className={button('secondary', 'sm')}
                >
                  Open dashboard
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-sm text-slate-700">
        Teaching this?{' '}
        <button type="button" onClick={onTeacher} className={`rounded-sm font-semibold text-sky-900 underline ${FOCUS_RING}`}>
          I’m a teacher
        </button>
        {' · '}
        <button type="button" onClick={onTeacherGuide} className={`rounded-sm font-semibold text-sky-900 underline ${FOCUS_RING}`}>
          Guide for teachers
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
