import type { ReactNode, RefObject } from 'react';
import { BACK_LINK } from './buttonStyles.ts';
import { ChevronLeftIcon } from './icons.tsx';

type Props = {
  id: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  onBack?: () => void;
};

/** Back link, icon tile, focusable heading and intro text shared by the secondary screens. */
export function ScreenHeader({ id, headingRef, icon, title, children, onBack }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {onBack && (
        <button type="button" onClick={onBack} className={BACK_LINK}>
          <ChevronLeftIcon className="size-4" />
          Back
        </button>
      )}
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-800 text-white shadow-sm">{icon}</span>
        <div className="min-w-0">
          <h2 id={id} ref={headingRef} tabIndex={-1} className="text-3xl font-black tracking-tight outline-none">
            {title}
          </h2>
          {children && <div className="mt-1.5 text-slate-700">{children}</div>}
        </div>
      </div>
    </div>
  );
}
