import { useId } from 'react';
import type { FakeLink as FakeLinkData } from '../data/messages.ts';

/**
 * Looks like a link but is never a real anchor: nothing in a training message
 * can navigate anywhere. Hover or keyboard focus reveals the real destination,
 * the same way a mail client's status bar would.
 */
export function FakeLink({ link }: { link: FakeLinkData }) {
  const tooltipId = useId();
  return (
    <span className="group relative inline-block">
      <span
        tabIndex={0}
        aria-describedby={tooltipId}
        className="cursor-pointer rounded-sm text-blue-600 underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {link.text}
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 font-mono text-xs text-white shadow-lg group-hover:block group-focus-within:block"
      >
        {link.realUrl}
      </span>
    </span>
  );
}
