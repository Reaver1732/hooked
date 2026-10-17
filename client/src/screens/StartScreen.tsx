import { PRIMARY_BUTTON } from '../components/buttonStyles.ts';

export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="flex flex-col items-start gap-6 py-10 sm:py-20">
      <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">Hooked</h1>
      <p className="max-w-md text-lg text-slate-600">
        Sort real-looking emails and texts into phish or legit, and learn the red flags you missed.
      </p>
      <button type="button" onClick={onStart} className={PRIMARY_BUTTON}>
        Start
      </button>
    </section>
  );
}
