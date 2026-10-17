import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/buttonStyles.ts';

type Props = { onStart: () => void; onPasswordCheck: () => void };

export function StartScreen({ onStart, onPasswordCheck }: Props) {
  return (
    <section className="flex flex-col items-start gap-6 py-10 sm:py-20">
      <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">Hooked</h1>
      <p className="max-w-md text-lg text-slate-600">
        Sort real-looking emails and texts into phish or legit, and learn the red flags you missed.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onStart} className={PRIMARY_BUTTON}>
          Start
        </button>
        <button type="button" onClick={onPasswordCheck} className={SECONDARY_BUTTON}>
          Check a password
        </button>
      </div>
    </section>
  );
}
