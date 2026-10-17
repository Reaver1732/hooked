export type Tone = 'flag' | 'safe';

const TONE_CLASSES: Record<Tone, string> = {
  flag: 'bg-red-600 text-white',
  safe: 'bg-emerald-600 text-white',
};

export function Badge({ n, tone, className = '' }: { n: number; tone: Tone; className?: string }) {
  return (
    <span
      className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] leading-none font-bold ${TONE_CLASSES[tone]} ${className}`}
    >
      <span className="sr-only">{tone === 'flag' ? 'Red flag ' : 'Safe sign '}</span>
      {n}
    </span>
  );
}
