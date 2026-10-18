import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { CLASS_IDLE_DAYS, type ClassSummary, type Score } from '../../../shared/api.ts';
import { FLAG_LABELS } from '../../../shared/flags.ts';
import { api, ApiRequestError } from '../class/api.ts';
import { dashboardUrl, type TeacherCredentials } from '../class/dashboardLink.ts';
import { ClassJoinPanel } from '../components/ClassJoinPanel.tsx';
import { ClockIcon, FlagIcon, FishIcon, LockIcon, TrashIcon, UsersIcon } from '../components/icons.tsx';
import { button, FullScreenButton, IconTile, Notice, TextButton } from '../design/parts.tsx';

const REFRESH_MS = 5000;
const WARN_MS = 24 * 60 * 60 * 1000;
const KIND_LABELS = { email: 'Email', text: 'Text', dm: 'DM' } as const;

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );

type PlayerRow = ClassSummary['players'][number];

const scoreText = (s: Score) => `${s.correct}/${s.total}`;

/** CSV cell: quoted, with a leading ' on anything a spreadsheet would run as a formula. */
function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(summary: ClassSummary) {
  const rows = [
    ['Nickname', 'First score (%)', 'Best score (%)', 'Attempts', 'Passed'],
    ...summary.players.map((p) => [
      p.nickname,
      p.first ? p.first.percent : '',
      p.best ? p.best.percent : '',
      p.attempts,
      p.passed ? 'Yes' : 'No',
    ]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: `hooked-class-${summary.code}-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  link.click();
  URL.revokeObjectURL(url);
}

type Props = {
  credentials: TeacherCredentials;
  /** The class was deleted or has expired (so this browser can forget it). */
  onGone: () => void;
  /** The teacher got a new dashboard link; the old key no longer works. */
  onNewKey: (credentials: TeacherCredentials) => void;
};

export function DashboardScreen({ credentials, onGone, onNewKey }: Props) {
  const { code, teacherKey } = credentials;
  // A refresh sent with the old key can land after a new link was made; ignore its answer.
  const keyRef = useRef(teacherKey);
  keyRef.current = teacherKey;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const playersHeadingRef = useRef<HTMLHeadingElement>(null);
  const qrDialogRef = useRef<HTMLDialogElement>(null);
  const projectorRef = useRef<HTMLDivElement>(null);
  const onGoneRef = useRef(onGone);
  onGoneRef.current = onGone;
  const targetId = useId();
  const [notice, setNotice] = useState<string | null>(null);
  const [summary, setSummary] = useState<ClassSummary | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [keeping, setKeeping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkShown, setLinkShown] = useState(false);
  const [targetDraft, setTargetDraft] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<{ playerId: string; nickname: string; code: string } | null>(null);
  const [gone, setGone] = useState<string | null>(null); // why the class is no longer available
  // `fatal` stops polling (bad key, class gone); otherwise the last good data stays up.
  const [error, setError] = useState<{ message: string; fatal: boolean } | null>(null);

  const handleError = useCallback((err: unknown, fallback: string) => {
    const status = err instanceof ApiRequestError ? err.status : null;
    const message = err instanceof ApiRequestError ? err.message : fallback;
    if (status === 404) setGone(message);
    else setError({ message, fatal: status === 401 });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await api.summary(code, teacherKey);
      if (keyRef.current !== teacherKey) return;
      setSummary(next);
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      if (keyRef.current === teacherKey) handleError(err, 'Couldn’t load the class.');
    }
  }, [code, teacherKey, handleError]);

  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);

  // Opening the dashboard counts as activity, once: the first keep call that succeeds. The
  // 5-second refreshes don't. A keep that fails (network, server error) is retried on the next
  // tick, so one blip doesn't leave the dashboard stuck on "Loading…".
  const keptRef = useRef(false);

  // Poll every 5 s, one request at a time, and skip the refresh while the tab is hidden.
  const stopped = gone !== null || (error?.fatal ?? false);
  useEffect(() => {
    if (stopped) return;
    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      if (!keptRef.current) {
        try {
          await api.keepClass(code, teacherKey);
          keptRef.current = true;
        } catch (err) {
          if (!cancelled) handleError(err, 'Couldn’t load the class.');
        }
      }
      if (keptRef.current && !cancelled && document.visibilityState === 'visible') await refresh();
      if (!cancelled) timer = window.setTimeout(tick, REFRESH_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refresh, stopped, code, teacherKey, handleError]);

  // Once the class is gone its dashboard address is useless; drop it, and forget the key here.
  useEffect(() => {
    if (!gone) return;
    onGoneRef.current();
    window.history.replaceState(null, '', window.location.pathname);
    headingRef.current?.focus({ preventScroll: true });
  }, [gone]);

  async function keepClass() {
    if (keeping) return; // not `disabled`: that would drop keyboard focus
    setKeeping(true);
    try {
      const { expiresAt } = await api.keepClass(code, teacherKey);
      setSummary((s) => s && { ...s, expiresAt });
      setNotice(`Kept. This class now deletes on ${formatWhen(expiresAt)} if unused.`);
    } catch (err) {
      handleError(err, 'Couldn’t keep the class.');
    } finally {
      setKeeping(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(dashboardUrl(credentials));
      setCopied(true);
    } catch {
      // The address bar no longer holds the key, so show the link to copy by hand.
      setCopied(false);
      setLinkShown(true);
      setNotice('Couldn’t copy automatically, so the link is shown below. Select it and copy it somewhere safe.');
    }
  }

  const [renewing, setRenewing] = useState(false);
  async function newLink() {
    if (renewing) return; // not `disabled`: that would drop keyboard focus
    if (
      !window.confirm(
        'Get a new dashboard link? The current link stops working everywhere, including other tabs and devices that have it open. Results are kept.',
      )
    ) {
      return;
    }
    setRenewing(true);
    try {
      const { teacherKey: next } = await api.newTeacherKey(code, teacherKey);
      onNewKey({ code, teacherKey: next });
      setCopied(false);
      setLinkShown(true);
      setNotice('New dashboard link ready, shown below. The old one no longer works. Copy this one somewhere safe.');
    } catch (err) {
      handleError(err, 'Couldn’t make a new link.');
    } finally {
      setRenewing(false);
    }
  }

  async function saveTarget(e: FormEvent) {
    e.preventDefault();
    if (!summary) return;
    // No draft means the field still shows the saved value, so save that.
    const value = targetDraft === null ? summary.targetPercent : Number(targetDraft);
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      setNotice('Passing score must be a whole number from 1 to 100.');
      return;
    }
    try {
      await api.setTargetPercent(code, teacherKey, value);
      // Show the new value right away instead of the old one until the refresh lands.
      setSummary((s) => s && { ...s, targetPercent: value });
      setTargetDraft(null);
      await refresh();
      setNotice(`Passing score set to ${value}%.`);
    } catch (err) {
      handleError(err, 'Couldn’t save the passing score.');
    }
  }

  async function resetCode(p: PlayerRow) {
    if (!window.confirm(`Give “${p.nickname}” a new rejoin code? Their old code will stop working.`)) return;
    try {
      const { rejoinCode } = await api.resetRejoinCode(code, teacherKey, p.id);
      setNewCode({ playerId: p.id, nickname: p.nickname, code: rejoinCode });
    } catch (err) {
      if (await playerAlreadyGone(err, `${p.nickname} is no longer in this class.`)) return;
      handleError(err, 'Couldn’t reset that code.');
    }
  }

  /**
   * A 404 from a player action usually means just that player is gone (removed on another
   * device, or a double click), not the class. Refresh to tell them apart: if the class is
   * gone the refresh says so; otherwise the row disappears and this says what happened.
   */
  async function playerAlreadyGone(err: unknown, message: string): Promise<boolean> {
    if (!(err instanceof ApiRequestError && err.status === 404)) return false;
    await refresh();
    setNotice(message);
    playersHeadingRef.current?.focus();
    return true;
  }

  async function deleteClass() {
    if (!window.confirm(`Delete class ${code}? All players and their answers will be deleted. This can’t be undone.`)) return;
    try {
      await api.deleteClass(code, teacherKey);
      setGone(`Class ${code} was deleted, along with its players and answers.`);
    } catch (err) {
      handleError(err, 'Couldn’t delete the class.');
    }
  }

  async function removePlayer(id: string, nickname: string) {
    if (!window.confirm(`Remove “${nickname}” from the class? Their answers will be deleted.`)) return;
    try {
      await api.removePlayer(code, teacherKey, id);
      await refresh();
      // The focused Remove button is gone now; say what happened and keep focus in the list.
      setNotice(`Removed ${nickname}.`);
      playersHeadingRef.current?.focus();
    } catch (err) {
      if (await playerAlreadyGone(err, `${nickname} was already removed.`)) return;
      handleError(err, 'Couldn’t remove that player.');
    }
  }

  if (gone) {
    return (
      <section aria-labelledby="dashboard-heading" className="hk-card flex flex-col items-start gap-4 p-6 sm:p-8">
        <IconTile tone="mark" size="lg">
          <TrashIcon className="size-7" />
        </IconTile>
        <h2 id="dashboard-heading" ref={headingRef} tabIndex={-1} className="hk-display text-title outline-none">
          This class is gone
        </h2>
        <p className="text-card-ink-muted">{gone}</p>
        <a href="/" className={button('primary')}>
          Back to Hooked
        </a>
      </section>
    );
  }

  const expiresSoon = summary !== null && new Date(summary.expiresAt).getTime() - Date.now() < WARN_MS;

  return (
    <section aria-labelledby="dashboard-heading" className="flex flex-col gap-6">
      <div className="rounded-card bg-raised px-5 py-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h2 id="dashboard-heading" ref={headingRef} tabIndex={-1} className="text-micro font-bold tracking-wide text-ink-muted uppercase outline-none">
              Teacher dashboard
            </h2>
            <p className="font-code text-display font-black tracking-[0.12em]">
              <span className="sr-only">Class code </span>
              {code}
            </p>
          </div>
          <button type="button" onClick={() => qrDialogRef.current?.showModal()} className={button('primary', 'sm')}>
            Show QR code
          </button>
        </div>
        <p className="mt-3 text-micro text-ink-muted" aria-live="off">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()} · refreshes every 5 s` : 'Loading…'}
        </p>
      </div>

      {/* Projector view. A native modal dialog: Escape closes it and focus returns to the button. */}
      {/* The backdrop is opaque: at 85% the player list behind it was readable on a projector. */}
      <dialog
        ref={qrDialogRef}
        aria-labelledby="qr-dialog-heading"
        // Closing while in full screen would leave a blank screen up; leave full screen too.
        onClose={() => {
          if (document.fullscreenElement) void document.exitFullscreen();
        }}
        className="hk-card m-auto w-[min(64rem,calc(100vw-1rem))] max-w-none p-0 backdrop:bg-canvas"
      >
        <div ref={projectorRef} className="hk-projector px-5 py-6 sm:px-10 sm:py-8">
          <ClassJoinPanel
            code={code}
            large
            heading={
              <div className="flex items-start justify-between gap-4">
                <h2 id="qr-dialog-heading" className="hk-display text-title">
                  Scan to join, or enter the class code
                </h2>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <FullScreenButton target={projectorRef} />
                  <form method="dialog">
                    <button type="submit" className={button('secondary', 'sm')}>
                      Close
                    </button>
                  </form>
                </div>
              </div>
            }
          />
        </div>
      </dialog>

      {/* Live region stays mounted (so it announces) but takes no space while empty. */}
      <div aria-live="polite" className="-mt-6 flex flex-col">
        {error && (
          <div className="mt-6">
            <Notice tone="error">
              {error.message}
              {!error.fatal && summary && ' Showing the last results; retrying.'}
            </Notice>
          </div>
        )}
        {notice && (
          <div className="mt-6">
            <Notice>{notice}</Notice>
          </div>
        )}
      </div>

      {summary && (
        <>
          {expiresSoon && (
            <section aria-labelledby="expiry-warning-heading" className="hk-card border-4 border-primary p-5 sm:p-6">
              <h3 id="expiry-warning-heading" className="hk-display flex items-center gap-3 text-heading">
                <IconTile tone="primary">
                  <ClockIcon className="size-6" />
                </IconTile>
                This class deletes soon
              </h3>
              <p className="mt-3 text-card-ink-muted">
                Unless someone uses it, class {code} and all its results will be deleted on{' '}
                <strong className="text-card-ink">{formatWhen(summary.expiresAt)}</strong>.
              </p>
              <button type="button" onClick={keepClass} aria-busy={keeping} className={`${button('primary')} mt-4`}>
                {keeping ? 'Keeping…' : 'Keep this class'}
              </button>
            </section>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="hk-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <p className="flex items-center gap-3 text-small text-card-ink-muted">
                <ClockIcon className="size-5 shrink-0 text-card-ink" />
                <span>
                  Deletes on <strong className="text-card-ink">{formatWhen(summary.expiresAt)}</strong> if unused
                  <span className="block text-micro">Any join, answer, or visit here resets the {CLASS_IDLE_DAYS}-day timer.</span>
                </span>
              </p>
              {!expiresSoon && (
                <button type="button" onClick={keepClass} aria-busy={keeping} className={button('secondary', 'sm')}>
                  {keeping ? 'Keeping…' : 'Keep this class'}
                </button>
              )}
            </div>

            <div className="hk-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <p className="flex items-center gap-3 text-small text-card-ink-muted">
                <LockIcon className="size-5 shrink-0 text-card-ink" />
                Anyone with this link can manage your class. Keep it private.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <button type="button" onClick={copyLink} className={button('secondary', 'sm')}>
                  {copied ? 'Copied' : 'Copy dashboard link'}
                </button>
                <button type="button" onClick={newLink} aria-busy={renewing} className="hk-link text-small">
                  {renewing ? 'Getting a new link…' : 'Get a new link'}
                </button>
              </div>
              <p aria-live="polite" className="sr-only">
                {copied ? 'Dashboard link copied' : ''}
              </p>
              {linkShown && (
                <p className="w-full rounded-chip bg-surface-muted px-3 py-2 font-code text-micro break-all select-all">
                  {dashboardUrl(credentials)}
                </p>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-3 sm:gap-4">
            <Stat icon={<UsersIcon className="size-5" />} label="Players" value={String(summary.playerCount)} />
            <Stat
              icon={<FishIcon className="size-5" />}
              label="Average best"
              value={summary.averageBestPercent === null ? '–' : `${summary.averageBestPercent}%`}
            />
            <Stat icon={<FlagIcon className="size-5" />} label="Passed" value={`${summary.passedCount} / ${summary.playerCount}`} />
          </dl>

          <Panel icon={<UsersIcon className="size-6" />} title="Players" headingRef={playersHeadingRef}>
            <form onSubmit={saveTarget} className="mt-4 flex flex-wrap items-end gap-3 rounded-control bg-surface-muted p-4">
              <div>
                <label htmlFor={targetId} className="block text-small font-bold">
                  Passing score
                </label>
                <span className="mt-1 flex items-center gap-2">
                  <input
                    id={targetId}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    step={1}
                    required
                    value={targetDraft ?? String(summary.targetPercent)}
                    onChange={(e) => setTargetDraft(e.target.value)}
                    className="hk-input min-h-10 w-20"
                  />
                  <span aria-hidden className="font-bold">
                    %
                  </span>
                </span>
              </div>
              <button type="submit" className={button('secondary', 'sm')}>
                Save
              </button>
              <p className="basis-full text-micro text-card-ink-muted">A student passes when their best finished run reaches this score.</p>
            </form>

            {summary.players.length === 0 ? (
              <p className="mt-4 text-small text-card-ink-muted">Nobody has joined yet. Share the code {code}.</p>
            ) : (
              <>
                <ul role="list" className="mt-2 divide-y divide-line">
                  {summary.players.map((p) => (
                    <li key={p.id} className="flex flex-col gap-2 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 text-heading font-bold wrap-break-word">{p.nickname}</span>
                        <span
                          className={`rounded-full px-3 py-0.5 text-micro font-bold ${p.passed ? 'bg-good text-on-good' : 'bg-surface-muted text-card-ink'}`}
                        >
                          {p.passed ? 'Passed' : 'Not yet'}
                        </span>
                      </div>
                      <p className="text-small text-card-ink-muted">
                        {p.first && p.best ? (
                          <>
                            First <strong className="text-card-ink">{p.first.percent}%</strong> ({scoreText(p.first)}) · Best{' '}
                            <strong className="text-card-ink">{p.best.percent}%</strong> ({scoreText(p.best)})
                          </>
                        ) : (
                          'No finished run yet'
                        )}
                        {' · '}
                        {p.attempts} {p.attempts === 1 ? 'attempt' : 'attempts'}
                        {p.inProgress !== null && ` · playing now (${p.inProgress}/${summary.totalMessages})`}
                      </p>
                      {newCode?.playerId === p.id && (
                        <p aria-live="polite" className="rounded-control border-2 border-primary bg-surface-muted px-4 py-3 text-small">
                          New rejoin code for {newCode.nickname}:{' '}
                          <strong className="font-code text-heading tracking-widest">{newCode.code}</strong>. It’s shown only once.{' '}
                          <TextButton onClick={() => setNewCode(null)}>Done</TextButton>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => resetCode(p)}
                          aria-label={`Reset code for ${p.nickname}`}
                          className={button('secondary', 'sm')}
                        >
                          Reset code
                        </button>
                        <button
                          type="button"
                          onClick={() => removePlayer(p.id, p.nickname)}
                          aria-label={`Remove ${p.nickname}`}
                          className={button('secondary', 'sm')}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => exportCsv(summary)} className={`${button('accent', 'sm')} mt-4`}>
                  Export CSV
                </button>
              </>
            )}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Panel
              icon={<FlagIcon className="size-6" />}
              tone="mark"
              title="Most-missed red flags"
              subtitle="From each student’s first finished run, before they’d seen any answers: red flags in phish they marked Legit."
            >
              {summary.mostMissedFlags.length === 0 ? (
                <p className="mt-4 text-small text-card-ink-muted">None yet.</p>
              ) : (
                <ol role="list" className="mt-2 divide-y divide-line">
                  {summary.mostMissedFlags.map(({ type, count }) => (
                    <li key={type} className="flex items-center justify-between gap-4 py-3">
                      <span>{FLAG_LABELS[type]}</span>
                      <span className="shrink-0 rounded-full bg-bad px-3 py-0.5 text-small font-bold text-on-bad">
                        {count}
                        <span className="sr-only"> missed</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel icon={<FishIcon className="size-6" />} title="Per message" subtitle="Percent correct in each student’s first finished run.">
              <ol role="list" className="mt-2 divide-y divide-line">
                {summary.perMessage.map((m, i) => (
                  <li key={m.id} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-small">
                        <span className="text-card-ink-muted">
                          {i + 1}. {KIND_LABELS[m.kind]} ·{' '}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-micro font-bold ${m.isPhish ? 'bg-bad text-on-bad' : 'bg-good text-on-good'}`}>
                          {m.isPhish ? 'Phish' : 'Legit'}
                        </span>{' '}
                        <span className="wrap-break-word">{m.label}</span>
                      </p>
                      <p className="hk-display shrink-0 text-heading">
                        {m.percentCorrect === null ? '–' : `${m.percentCorrect}%`}
                        <span className="sr-only"> correct</span>
                      </p>
                    </div>
                    <div aria-hidden className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-card-ink" style={{ width: `${m.percentCorrect ?? 0}%` }} />
                    </div>
                    <p className="mt-1 text-micro text-card-ink-muted">
                      {m.answered} {m.answered === 1 ? 'answer' : 'answers'}
                    </p>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          <section aria-labelledby="danger-heading" className="hk-card border-4 border-bad p-5 sm:p-6">
            <h3 id="danger-heading" className="hk-display text-heading">
              Delete this class
            </h3>
            <p className="mt-2 text-small text-card-ink-muted">
              Removes the class, its players, and all their answers right away. Students still playing will see that the
              class was closed.
            </p>
            <button type="button" onClick={deleteClass} className={`${button('danger')} mt-4`}>
              <TrashIcon className="size-5" />
              Delete class
            </button>
          </section>
        </>
      )}
    </section>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="hk-card p-3 sm:p-5">
      <dt className="flex items-center gap-2 text-micro font-bold text-card-ink-muted sm:text-small">
        <span className="hidden text-card-ink sm:inline">{icon}</span>
        {label}
      </dt>
      <dd className="hk-display mt-1 text-title">{value}</dd>
    </div>
  );
}

type PanelProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  tone?: 'accent' | 'mark';
  children: ReactNode;
  headingRef?: RefObject<HTMLHeadingElement | null>;
};

function Panel({ title, subtitle, icon, tone = 'accent', children, headingRef }: PanelProps) {
  return (
    <section className="hk-card p-5 sm:p-6">
      <h3 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="hk-display flex items-center gap-3 text-heading outline-none">
        {icon && <IconTile tone={tone}>{icon}</IconTile>}
        {title}
      </h3>
      {subtitle && <p className="mt-2 text-small text-card-ink-muted">{subtitle}</p>}
      {children}
    </section>
  );
}
