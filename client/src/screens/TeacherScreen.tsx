import { useEffect, useRef, useState } from 'react';
import { api, ApiRequestError } from '../class/api.ts';
import { dashboardHash, dashboardUrl, type TeacherCredentials } from '../class/dashboardLink.ts';
import { BACK_LINK, FOCUS_RING, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/buttonStyles.ts';

type Props = { onBack: () => void; onOpenDashboard: (credentials: TeacherCredentials) => void };

export function TeacherScreen({ onBack, onOpenDashboard }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [created, setCreated] = useState<TeacherCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => headingRef.current?.focus({ preventScroll: true }), [created]);

  async function createClass() {
    setError(null);
    setBusy(true);
    try {
      setCreated(await api.createClass());
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
        <button type="button" onClick={onBack} className={BACK_LINK}>
          ← Back
        </button>
        <div>
          <h2 id="teacher-heading" ref={headingRef} tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none">
            Run a class
          </h2>
          <p className="mt-2 text-slate-600">
            Create a class to get a code for students to join, plus a private dashboard showing how the class is doing.
            Students only share a nickname and their answers.
          </p>
        </div>
        <div aria-live="polite">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">{error}</p>}
        </div>
        <button type="button" onClick={createClass} disabled={busy} className={`${PRIMARY_BUTTON} self-start`}>
          {busy ? 'Creating…' : 'Create a class'}
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="teacher-heading" className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className={BACK_LINK}>
        ← Back
      </button>
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center">
        <h2 id="teacher-heading" ref={headingRef} tabIndex={-1} className="text-lg font-medium text-slate-600 outline-none">
          Join at this site with code
        </h2>
        <p
          aria-label={`Class code ${created.code.split('').join(' ')}`}
          className="mt-2 font-mono text-6xl font-bold tracking-[0.15em] wrap-anywhere sm:text-8xl"
        >
          {created.code}
        </p>
        <p className="mt-3 text-sm text-slate-500">{window.location.host}</p>
      </div>

      <section aria-labelledby="dashboard-link-heading" className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <h3 id="dashboard-link-heading" className="text-lg font-semibold text-amber-950">
          Your dashboard link
        </h3>
        <p className="mt-1 text-sm text-amber-900">
          <strong>Keep this link private.</strong> Anyone with it can see your class’s results and remove students.
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
