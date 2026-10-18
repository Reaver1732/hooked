import type { ReactNode } from 'react';
import { joinUrl } from '../class/joinLink.ts';
import { JoinQrCode } from './JoinQrCode.tsx';

/** Projector view: QR code, class code, and the join link. Used on the teacher screen and dashboard. */
export function ClassJoinPanel({ code, heading, large = false }: { code: string; heading: ReactNode; large?: boolean }) {
  return (
    <>
      {heading}
      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[1fr_1fr]">
        <JoinQrCode url={joinUrl(code)} sizeClass={large ? 'max-w-80 lg:max-w-md' : undefined} />
        <div className="text-center">
          <p className="text-small font-bold tracking-wide text-card-ink-muted uppercase">Class code</p>
          <p className={`font-code font-black tracking-[0.08em] whitespace-nowrap ${large ? 'text-jumbo' : 'text-display'}`}>
            <span className="sr-only">{code.split('').join(' ')}</span>
            <span aria-hidden>{code}</span>
          </p>
        </div>
      </div>
      <p className="mt-6 text-center text-small font-bold tracking-wide text-card-ink-muted uppercase">Or go to</p>
      <p className="text-center font-code text-heading font-bold break-all">
        {joinUrl(code).replace(/^https?:\/\//, '')}
      </p>
    </>
  );
}
