import { HookIcon } from './icons.tsx';

type Props = { size?: 'sm' | 'lg'; tone?: 'light' | 'dark'; bob?: boolean };

/** "Hooked" wordmark with the hook mark. The text is the accessible name. */
export function Logo({ size = 'sm', tone = 'light', bob = false }: Props) {
  const mark = tone === 'dark' ? 'text-amber-300' : 'text-sky-800';
  const word = tone === 'dark' ? 'text-white' : 'text-slate-900';
  const motion = bob ? 'motion-safe:animate-bob' : '';
  return size === 'lg' ? (
    <span className="inline-flex items-center gap-1">
      <span className={`relative shrink-0 ${motion}`}>
        {/* The line the hook hangs from; the hero clips it at its top edge. */}
        {bob && <span aria-hidden className="absolute bottom-[88%] left-[61%] h-48 w-0.5 bg-amber-200/80" />}
        <HookIcon className={`size-14 sm:size-16 ${mark}`} />
      </span>
      <span className={`text-6xl font-black tracking-tight sm:text-7xl ${word}`}>Hooked</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1">
      <HookIcon className={`size-7 shrink-0 ${mark}`} />
      <span className={`text-xl font-black tracking-tight ${word}`}>Hooked</span>
    </span>
  );
}
