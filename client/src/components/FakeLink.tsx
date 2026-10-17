import type { FakeLink as FakeLinkData } from '../../../shared/messages.ts';
import { TooltipTrigger } from './Tooltip.tsx';

/**
 * Looks like a link but is never a real anchor: nothing in a training message
 * can navigate anywhere. Hover or keyboard focus reveals the real destination,
 * the same way a mail client's status bar would. Escape dismisses it.
 */
export function FakeLink({ link }: { link: FakeLinkData }) {
  return (
    <TooltipTrigger
      tip={link.realUrl}
      tipClassName="font-mono break-all"
      triggerClassName="cursor-pointer rounded-sm text-blue-700 underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      {link.text}
    </TooltipTrigger>
  );
}
