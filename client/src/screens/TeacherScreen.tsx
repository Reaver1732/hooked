import { useEffect, useRef, useState } from 'react';
import { api, ApiRequestError } from '../class/api.ts';
import { dashboardLinkHash, dashboardUrl, type TeacherCredentials } from '../class/dashboardLink.ts';
import { ClassJoinPanel } from '../components/ClassJoinPanel.tsx';
import { CLASS_IDLE_DAYS } from '../../../shared/api.ts';
import { ChalkboardIcon, LockIcon } from '../components/icons.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { BackButton, button, FullScreenButton, IconTile, Notice, StepNumber, TextButton } from '../design/parts.tsx';

type Props = {
  onBack: () => void;
  onOpenDashboard: (credentials: TeacherCredentials) => void;
  onTeacherGuide: () => void;
  /** Lets the app remember this class on this browser. */
  onCreated: (credentials: TeacherCredentials) => void;
};

export function TeacherScreen({ onBack, onOpenDashboard, onTeacherGuide, onCreated }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const projectorRef = useRef<HTMLDivElement>(null);
  const [projecting, setProjecting] = useState(false);
  const [created, setCreated] = useState<TeacherCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // This screen is the projector view, so the dashboard key stays hidden until asked for.
  const [showLink, setShowLink] = useState(false);

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
      setCopyFailed(false);
    } catch {
      // Without the clipboard, the teacher still needs a way to save the link.
      setCopied(false);
      setCopyFailed(true);
      setShowLink(true);
    }
  }

  if (!created) {
    return (
      <section aria-labelledby="teacher-heading" className="flex flex-col gap-6">
        <ScreenHeader id="teacher-heading" headingRef={headingRef} icon={<ChalkboardIcon className="size-7" />} title="Run a class" onBack={onBack}>
          Get a code your students can join, and a private dashboard that shows how the class is doing.
        </ScreenHeader>

        <ol className="hk-card flex flex-col gap-5 p-5 sm:p-6">
          {[
            ['Share the code', 'Project the QR code and class code. Students join with just a nickname.'],
            ['Students play', 'Everyone sorts the same messages into phish or legit at their own pace.'],
            ['Watch the dashboard', 'See scores, the red flags your class misses most, and how each message went.'],
          ].map(([title, text], i) => (
            <li key={title} className="flex gap-4">
              <StepNumber n={i + 1} />
              <span>
                <span className="hk-display block text-heading">{title}</span>
                <span className="text-small text-card-ink-muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-small text-ink-muted">
          Students share only a nickname and their answers. Classes are deleted after {CLASS_IDLE_DAYS} days without
          activity.{' '}
          <TextButton onClick={onTeacherGuide} className="text-ink">
            Read the guide for teachers
          </TextButton>{' '}
          for a lesson plan and discussion questions.
        </p>

        <div aria-live="polite">{error && <Notice tone="error">{error}</Notice>}</div>
        <button type="button" onClick={createClass} aria-busy={busy} className={`${button('primary', 'lg')} self-start`}>
          {busy ? 'Creating…' : 'Create a class'}
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="teacher-heading" className="flex flex-col gap-6">
      <BackButton onClick={onBack} />
      <div ref={projectorRef} className="hk-card hk-projector px-5 py-8 sm:px-8">
        <ClassJoinPanel
          code={created.code}
          large={projecting}
          heading={
            <h2 id="teacher-heading" ref={headingRef} tabIndex={-1} className="hk-display text-center text-title outline-none">
              Scan to join, or enter the class code
            </h2>
          }
        />
        <div className="mt-6 flex justify-center">
          <FullScreenButton target={projectorRef} onChange={setProjecting} />
        </div>
      </div>

      <section aria-labelledby="dashboard-link-heading" className="hk-card border-4 border-primary p-5 sm:p-6">
        <h3 id="dashboard-link-heading" className="hk-display flex items-center gap-3 text-heading">
          <IconTile tone="primary">
            <LockIcon className="size-6" />
          </IconTile>
          Your dashboard link
        </h3>
        <p className="mt-3 text-small text-card-ink-muted">
          <strong className="text-card-ink">Private:</strong> anyone with this link can see results, remove students, reset
          their rejoin codes and delete the class. Save it somewhere safe. It can’t be recovered.
        </p>
        <p id="dashboard-link" className="mt-4 rounded-chip bg-surface-muted px-3 py-2 font-code text-micro break-all">
          {showLink ? (
            dashboardUrl(created)
          ) : (
            <>
              {dashboardUrl({ ...created, teacherKey: '' })}
              <span aria-hidden>••••••••••</span>
              <span className="sr-only">(private key hidden)</span>
            </>
          )}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <a href={dashboardLinkHash(created)} target="_blank" rel="noopener noreferrer" className={button('primary')}>
            Open dashboard in a new tab
          </a>
          <button type="button" onClick={() => copyLink(created)} className={button('secondary')}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button type="button" onClick={() => setShowLink((v) => !v)} aria-controls="dashboard-link" className={button('secondary')}>
            {showLink ? 'Hide link' : 'Show link'}
          </button>
          <TextButton onClick={() => onOpenDashboard(created)} className="text-small">
            Open here instead
          </TextButton>
        </div>
        <p aria-live="polite" className="mt-3 text-small text-card-ink-muted empty:mt-0">
          {copied
            ? 'Dashboard link copied.'
            : copyFailed
              ? 'Couldn’t copy automatically, so the link is shown above. Select it and copy it somewhere safe.'
              : ''}
        </p>
      </section>
    </section>
  );
}
