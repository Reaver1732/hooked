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
          <p className="text-sm font-semibold tracking-wide text-slate-700 uppercase">Class code</p>
          <p className={`font-mono font-black tracking-[0.08em] whitespace-nowrap text-sky-900 ${large ? 'text-5xl min-[400px]:text-6xl lg:text-8xl' : 'text-5xl min-[400px]:text-6xl'}`}>
            <span className="sr-only">{code.split('').join(' ')}</span>
            <span aria-hidden>{code}</span>
          </p>
        </div>
      </div>
      <p className="mt-6 text-center text-sm font-semibold tracking-wide text-slate-700 uppercase">Or go to</p>
      <p className="text-center font-mono text-lg font-semibold break-all text-slate-900 sm:text-xl">
        {joinUrl(code).replace(/^https?:\/\//, '')}
      </p>
    </>
  );
}
