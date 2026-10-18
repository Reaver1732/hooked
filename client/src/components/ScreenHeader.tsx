import type { ReactNode, RefObject } from 'react';
import { BackButton, IconTile } from '../design/parts.tsx';

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
      {onBack && <BackButton onClick={onBack} />}
      <div className="flex items-start gap-4">
        <IconTile size="lg">{icon}</IconTile>
        <div className="min-w-0">
          <h2 id={id} ref={headingRef} tabIndex={-1} className="hk-display text-title outline-none">
            {title}
          </h2>
          {children && <div className="mt-2 text-ink-muted">{children}</div>}
        </div>
      </div>
    </div>
  );
}
