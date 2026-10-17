import type { ReactNode } from 'react';
import { TooltipTrigger } from './Tooltip.tsx';

/**
 * A file attached to an email. Like links, attachments never do anything: the chip
 * only explains that on hover or focus. The extension tile helps spot risky types.
 */
export function AttachmentChip({ fileName, label, size }: { fileName: string; label: ReactNode; size: string }) {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.slice(0, 4).toUpperCase() : 'FILE';
  return (
    <TooltipTrigger
      tip="Attachments in this game can’t be opened."
      triggerClassName="flex max-w-full cursor-default items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 py-2 pr-4 pl-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-sky-800 text-[11px] font-bold tracking-wide text-white">
        {ext}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold break-all text-slate-900">{label}</span>
        <span className="block text-xs text-slate-700">{size}</span>
      </span>
    </TooltipTrigger>
  );
}
