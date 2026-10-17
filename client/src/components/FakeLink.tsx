import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { FakeLink as FakeLinkData } from '../data/messages.ts';

const VIEWPORT_MARGIN = 8;

/**
 * Looks like a link but is never a real anchor: nothing in a training message
 * can navigate anywhere. Hover or keyboard focus reveals the real destination,
 * the same way a mail client's status bar would. Escape dismisses it.
 */
export function FakeLink({ link }: { link: FakeLinkData }) {
  const tooltipId = useId();
  const tipRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [shift, setShift] = useState(0);
  const open = (hovered || focused) && !dismissed;

  // Nudge the tooltip sideways if it would spill off a narrow screen.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!open || !tip) return;
    const rect = tip.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    if (rect.left < VIEWPORT_MARGIN) setShift(VIEWPORT_MARGIN - rect.left);
    else if (rect.right > viewport - VIEWPORT_MARGIN) setShift(viewport - VIEWPORT_MARGIN - rect.right);
    return () => setShift(0);
  }, [open]);

  return (
    <span
      className="relative inline-block"
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
        className="cursor-pointer rounded-sm text-blue-700 underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        {link.text}
      </span>
      <span
        ref={tipRef}
        id={tooltipId}
        role="tooltip"
        style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
        className={`absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[calc(100vw-1rem)] rounded-md bg-slate-900 px-2 py-1 text-left font-mono text-xs font-normal break-all whitespace-normal text-white shadow-lg ${open ? 'block' : 'hidden'}`}
      >
        {link.realUrl}
      </span>
    </span>
  );
}
