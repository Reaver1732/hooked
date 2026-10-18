import { useEffect, useRef, useState } from 'react';
import { api, ApiRequestError } from '../class/api.ts';
import { dashboardHash, dashboardUrl, type TeacherCredentials } from '../class/dashboardLink.ts';
import { ClassJoinPanel } from '../components/ClassJoinPanel.tsx';
import { CLASS_IDLE_DAYS } from '../../../shared/api.ts';
import { BACK_LINK, button, CARD, FOCUS_RING, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/buttonStyles.ts';
import { ChalkboardIcon, ChevronLeftIcon } from '../components/icons.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';

type Props = {
  onBack: () => void;
  onOpenDashboard: (credentials: TeacherCredentials) => void;
  onTeacherGuide: () => void;
  /** Lets the app remember this class on this browser. */
  onCreated: (credentials: TeacherCredentials) => void;
};

export function TeacherScreen({ onBack, onOpenDashboard, onTeacherGuide, onCreated }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [created, setCreated] = useState<TeacherCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => headingRef.current?.focus({ preventScroll: true }), [created]);

  async function createClass() {
    if (busy) return; // not `disabled` while busy: that would drop keyboard focus
    setError(null);
    setBusy(true);
    try {
      const credentials = await api.createClass();
      onCreated(credentials);
      setCreated(credentials);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Couldn’t create a class.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(credentials: TeacherCredentials) {
    try {
      await navigator.clipboard.writeText(dashboardUrl(credentials));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!created) {
    return (
      <section aria-labelledby="teacher-heading" className="flex flex-col gap-6">
        <ScreenHeader id="teacher-heading" headingRef={headingRef} icon={<ChalkboardIcon className="size-6" />} title="Run a class" onBack={onBack}>
          Get a code your students can join, and a private dashboard that shows how the class is doing.
        </ScreenHeader>

        <ol className={`${CARD} flex flex-col gap-4 p-5 sm:p-6`}>
          {[
            ['Share the code', 'Project the QR code and class code. Students join with just a nickname.'],
            ['Students play', 'Everyone sorts the same messages into phish or legit at their own pace.'],
            ['Watch the dashboard', 'See scores, the red flags your class misses most, and how each message went.'],
          ].map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-sky-900">{i + 1}</span>
              <span>
                <span className="block font-bold">{title}</span>
                <span className="text-sm text-slate-700">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-slate-700">
          Students share only a nickname and their answers. Classes are deleted after {CLASS_IDLE_DAYS} days without
          activity.{' '}
          <button type="button" onClick={onTeacherGuide} className={`rounded-sm font-semibold text-sky-900 underline ${FOCUS_RING}`}>
            Read the guide for teachers
          </button>{' '}
          for a lesson plan and discussion questions.
        </p>

        <div aria-live="polite">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">{error}</p>}
        </div>
        <button type="button" onClick={createClass} aria-busy={busy} className={`${button('primary', 'lg')} self-start`}>
          {busy ? 'Creating…' : 'Create a class'}
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="teacher-heading" className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className={BACK_LINK}>
        <ChevronLeftIcon className="size-4" />
        Back
      </button>
      <div className={`${CARD} px-5 py-7 sm:px-8`}>
        <ClassJoinPanel
          code={created.code}
          heading={
            <h2 id="teacher-heading" ref={headingRef} tabIndex={-1} className="text-center text-2xl font-black tracking-tight outline-none sm:text-3xl">
              Scan to join, or enter the class code
            </h2>
          }
        />
      </div>

      <section aria-labelledby="dashboard-link-heading" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6">
        <h3 id="dashboard-link-heading" className="text-lg font-bold text-amber-950">
          Your dashboard link
        </h3>
        <p className="mt-1 text-sm text-amber-900">
          <strong>Keep this link private.</strong> Anyone with it can see your class’s results and remove students. This
          browser also remembers the class so you can reopen its dashboard from the start screen; on a shared computer,
          delete the class when you’re done or use a private window.
          Don’t project it or share it, and save it somewhere safe: it can’t be recovered.
        </p>
        <p className="mt-3 rounded-lg bg-white px-3 py-2 font-mono text-xs break-all text-slate-700 ring-1 ring-amber-200">
          {dashboardUrl(created)}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href={dashboardHash(created)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${PRIMARY_BUTTON} no-underline`}
          >
            Open dashboard in a new tab
          </a>
          <button type="button" onClick={() => copyLink(created)} className={SECONDARY_BUTTON}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={() => onOpenDashboard(created)}
            className={`rounded-md px-1 text-sm font-medium text-amber-950 underline ${FOCUS_RING}`}
          >
            Open here instead
          </button>
        </div>
        <p aria-live="polite" className="sr-only">
          {copied ? 'Dashboard link copied' : ''}
        </p>
      </section>
    </section>
  );
}
