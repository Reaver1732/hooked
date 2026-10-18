import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const VIEWPORT_MARGIN = 8;
/** How long a finger has to stay down to open the tooltip on a touch screen. */
const LONG_PRESS_MS = 400;

type Props = {
  /** Shown on hover and keyboard focus; also the trigger's accessible description. */
  tip: ReactNode;
  tipClassName?: string;
  triggerClassName: string;
  children: ReactNode;
};

/**
 * A focusable trigger with a tooltip above it, shown on hover, keyboard focus, or a long press
 * on a touch screen (instead of the browser's own menu), and dismissed with Escape or a touch
 * elsewhere. The tooltip shifts sideways to stay on narrow screens.
 */
export function TooltipTrigger({ tip, tipClassName = '', triggerClassName, children }: Props) {
  const tooltipId = useId();
  const tipRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [shift, setShift] = useState(0);
  const open = (hovered || focused || pressed) && !dismissed;
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const pressTimer = useRef<number | undefined>(undefined);
  const cancelPress = () => window.clearTimeout(pressTimer.current);

  // A long-press tooltip stays up until the next touch somewhere else.
  useEffect(() => {
    if (!pressed) return;
    const closeOnTouchElsewhere = (e: TouchEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setPressed(false);
    };
    document.addEventListener('touchstart', closeOnTouchElsewhere);
    return () => document.removeEventListener('touchstart', closeOnTouchElsewhere);
  }, [pressed]);
  useEffect(() => cancelPress, []);

  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!open || !el) return;
    const rect = el.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    if (rect.left < VIEWPORT_MARGIN) setShift(VIEWPORT_MARGIN - rect.left);
    else if (rect.right > viewport - VIEWPORT_MARGIN) setShift(viewport - VIEWPORT_MARGIN - rect.right);
    return () => setShift(0);
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className="relative inline-block max-w-full"
      onMouseEnter={() => {
        setHovered(true);
        setDismissed(false);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        tabIndex={0}
        aria-describedby={tooltipId}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setDismissed(true);
        }}
        onTouchStart={() => {
          cancelPress();
          pressTimer.current = window.setTimeout(() => {
            setPressed(true);
            setDismissed(false);
          }, LONG_PRESS_MS);
        }}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        onTouchCancel={cancelPress}
        // A long press shows where it goes, not the browser's "open link" menu.
        onContextMenu={(e) => e.preventDefault()}
        className={`select-none [-webkit-touch-callout:none] ${triggerClassName}`}
      >
        {children}
      </span>
      <span
        ref={tipRef}
        id={tooltipId}
        role="tooltip"
        style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
        className={`absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[calc(100vw-1rem)] rounded-md bg-slate-900 px-2 py-1 text-left text-xs font-normal whitespace-normal text-white shadow-lg ${tipClassName} ${open ? 'block' : 'hidden'}`}
      >
        {tip}
      </span>
    </span>
  );
}
