import { FOCUS_RING, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/buttonStyles.ts';
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
  return (
    <section className="flex flex-col items-start gap-6 py-10 sm:py-20">
      <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">Hooked</h1>
      <p className="max-w-md text-lg text-slate-600">
        Sort real-looking emails and texts into phish or legit, and learn the red flags you missed.
      </p>

      {session && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
          Playing in class <span className="font-mono font-semibold">{session.code}</span> as{' '}
          <strong>{session.nickname}</strong>.{' '}
          <button type="button" onClick={onLeaveClass} className={`rounded-sm underline ${FOCUS_RING}`}>
            Leave class
          </button>
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onStart} className={PRIMARY_BUTTON}>
          Start
        </button>
        {!session && (
          <button type="button" onClick={onJoinClass} className={SECONDARY_BUTTON}>
            Join a class
          </button>
        )}
        <button type="button" onClick={onPasswordCheck} className={SECONDARY_BUTTON}>
          Check a password
        </button>
      </div>

      <button type="button" onClick={onTeacher} className={`rounded-md text-sm font-medium text-slate-600 underline hover:text-slate-900 ${FOCUS_RING}`}>
        I’m a teacher
      </button>
    </section>
  );
}
