import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { CLASS_IDLE_DAYS, type ClassSummary } from '../../../shared/api.ts';
import { FLAG_LABELS } from '../../../shared/flags.ts';
import { api, ApiRequestError } from '../class/api.ts';
import { dashboardUrl, type TeacherCredentials } from '../class/dashboardLink.ts';
import { button, CARD, DANGER_BUTTON, FOCUS_RING, FOCUS_RING_ON_DARK, INPUT_FRAME, PRIMARY_BUTTON } from '../components/buttonStyles.ts';
import { ClassJoinPanel } from '../components/ClassJoinPanel.tsx';
import { ClockIcon, FlagIcon, FishIcon, LockIcon, TrashIcon, UsersIcon } from '../components/icons.tsx';

const REFRESH_MS = 5000;
const WARN_MS = 24 * 60 * 60 * 1000;
const KIND_LABELS = { email: 'Email', text: 'Text', dm: 'DM' } as const;

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );

type PlayerRow = ClassSummary['players'][number];

/** CSV cell: quoted, with a leading ' on anything a spreadsheet would run as a formula. */
function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(summary: ClassSummary) {
  const rows = [
    ['Nickname', 'Best score (%)', 'Attempts', 'Passed'],
    ...summary.players.map((p) => [p.nickname, p.best ? p.best.percent : '', p.attempts, p.passed ? 'Yes' : 'No']),
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
};

export function DashboardScreen({ credentials, onGone }: Props) {
  const { code, teacherKey } = credentials;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const playersHeadingRef = useRef<HTMLHeadingElement>(null);
  const qrDialogRef = useRef<HTMLDialogElement>(null);
  const onGoneRef = useRef(onGone);
  onGoneRef.current = onGone;
  const targetId = useId();
  const [notice, setNotice] = useState<string | null>(null);
  const [summary, setSummary] = useState<ClassSummary | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [keptOnLoad, setKeptOnLoad] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [copied, setCopied] = useState(false);
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
      setSummary(await api.summary(code, teacherKey));
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      handleError(err, 'Couldn’t load the class.');
    }
  }, [code, teacherKey, handleError]);

  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);

  // Opening the dashboard counts as activity, once. The 5-second refreshes below don't.
  useEffect(() => {
    let cancelled = false;
    api.keepClass(code, teacherKey).then(
      () => !cancelled && setKeptOnLoad(true),
      (err) => !cancelled && handleError(err, 'Couldn’t load the class.'),
    );
    return () => {
      cancelled = true;
    };
  }, [code, teacherKey, handleError]);

  // Poll every 5 s, one request at a time, and skip while the tab is hidden.
  const stopped = !keptOnLoad || gone !== null || (error?.fatal ?? false);
  useEffect(() => {
    if (stopped) return;
    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      if (document.visibilityState === 'visible') await refresh();
      if (!cancelled) timer = window.setTimeout(tick, REFRESH_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refresh, stopped]);

  // Once the class is gone the key in the address bar is useless; drop it, and forget it here.
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
      setCopied(false);
      setNotice('Couldn’t copy automatically. Copy the address from your browser’s address bar instead.');
    }
  }

  async function saveTarget(e: FormEvent) {
    e.preventDefault();
    const value = Number(targetDraft);
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      setNotice('Passing score must be a whole number from 1 to 100.');
      return;
    }
    try {
      await api.setTargetPercent(code, teacherKey, value);
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
      handleError(err, 'Couldn’t reset that code.');
    }
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
      handleError(err, 'Couldn’t remove that player.');
    }
  }

  if (gone) {
    return (
      <section aria-labelledby="dashboard-heading" className={`${CARD} flex flex-col items-start gap-4 p-6`}>
        <h2 id="dashboard-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-black outline-none">
          This class is gone
        </h2>
        <p className="text-slate-700">{gone}</p>
        <a href="/" className={`${PRIMARY_BUTTON} no-underline`}>
          Back to Hooked
        </a>
      </section>
    );
  }

  const expiresSoon = summary !== null && new Date(summary.expiresAt).getTime() - Date.now() < WARN_MS;

  return (
    <section aria-labelledby="dashboard-heading" className="flex flex-col gap-5">
      <div className="rounded-3xl bg-linear-to-b from-sky-900 to-cyan-800 px-5 py-6 text-white shadow-lg sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2 id="dashboard-heading" ref={headingRef} tabIndex={-1} className="text-sm font-semibold tracking-wide text-sky-100 uppercase outline-none">
              Teacher dashboard
            </h2>
            <p className="font-mono text-5xl font-black tracking-[0.12em]">
              <span className="sr-only">Class code </span>
              {code}
            </p>
          </div>
          <button
            type="button"
            onClick={() => qrDialogRef.current?.showModal()}
            className={`inline-flex min-h-10 items-center rounded-xl bg-amber-300 px-4 text-sm font-semibold text-slate-900 hover:bg-amber-200 ${FOCUS_RING_ON_DARK}`}
          >
            Show QR code
          </button>
        </div>
        <p className="mt-3 text-xs text-sky-100" aria-live="off">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()} · refreshes every 5 s` : 'Loading…'}
        </p>
      </div>

      {/* Projector view. A native modal dialog: Escape closes it and focus returns to the button. */}
      <dialog
        ref={qrDialogRef}
        aria-labelledby="qr-dialog-heading"
        className="m-auto w-[min(64rem,calc(100vw-1rem))] max-w-none rounded-3xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/75"
      >
        <div className="px-5 py-6 sm:px-10 sm:py-8">
          <ClassJoinPanel
            code={code}
            large
            heading={
              <div className="flex items-start justify-between gap-4">
                <h2 id="qr-dialog-heading" className="text-2xl font-black tracking-tight sm:text-4xl">
                  Scan to join, or enter the class code
                </h2>
                <form method="dialog">
                  <button type="submit" className={button('secondary', 'sm')}>
                    Close
                  </button>
                </form>
              </div>
            }
          />
        </div>
      </dialog>

      {/* Live region stays mounted (so it announces) but takes no space while empty. */}
      <div aria-live="polite" className="-mt-5">
        {error && (
          <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            {error.message}
            {!error.fatal && summary && ' Showing the last results; retrying.'}
          </p>
        )}
        {notice && <p className="mt-5 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-950 ring-1 ring-sky-200">{notice}</p>}
      </div>

      {summary && (
        <>
          {expiresSoon && (
            <section aria-labelledby="expiry-warning-heading" className="rounded-2xl border-2 border-amber-500 bg-amber-100 p-5">
              <h3 id="expiry-warning-heading" className="flex items-center gap-2 text-lg font-bold text-amber-950">
                <ClockIcon className="size-6" />
                This class deletes soon
              </h3>
              <p className="mt-1 text-amber-950">
                Unless someone uses it, class {code} and all its results will be deleted on{' '}
                <strong>{formatWhen(summary.expiresAt)}</strong>.
              </p>
              <button type="button" onClick={keepClass} aria-busy={keeping} className={`${PRIMARY_BUTTON} mt-3`}>
                {keeping ? 'Keeping…' : 'Keep this class'}
              </button>
            </section>
          )}

          <div className={`${CARD} flex flex-wrap items-center justify-between gap-3 px-5 py-4`}>
            <p className="flex items-center gap-2 text-sm text-slate-700">
              <ClockIcon className="size-5 shrink-0 text-sky-800" />
              <span>
                Deletes on <strong className="text-slate-900">{formatWhen(summary.expiresAt)}</strong> if unused
                <span className="block text-xs">Any join, answer, or visit here resets the {CLASS_IDLE_DAYS}-day timer.</span>
              </span>
            </p>
            {!expiresSoon && (
              <button type="button" onClick={keepClass} aria-busy={keeping} className={button('secondary', 'sm')}>
                {keeping ? 'Keeping…' : 'Keep this class'}
              </button>
            )}
          </div>

          <div className={`${CARD} flex flex-wrap items-center justify-between gap-3 px-5 py-4`}>
            <p className="flex items-center gap-2 text-sm text-slate-700">
              <LockIcon className="size-5 shrink-0 text-sky-800" />
              Anyone with this link can manage your class. Keep it private.
            </p>
            <button type="button" onClick={copyLink} className={button('secondary', 'sm')}>
              {copied ? 'Copied' : 'Copy dashboard link'}
            </button>
            <p aria-live="polite" className="sr-only">
              {copied ? 'Dashboard link copied' : ''}
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-3">
            <Stat icon={<UsersIcon className="size-5" />} label="Players" value={String(summary.playerCount)} />
            <Stat
              icon={<FishIcon className="size-5" />}
              label="Average best"
              value={summary.averageBestPercent === null ? '–' : `${summary.averageBestPercent}%`}
            />
            <Stat icon={<FlagIcon className="size-5" />} label="Passed" value={`${summary.passedCount} / ${summary.playerCount}`} />
          </dl>

          <Panel icon={<UsersIcon className="size-5" />} title="Players" headingRef={playersHeadingRef}>
            <form onSubmit={saveTarget} className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div>
                <label htmlFor={targetId} className="block text-sm font-semibold">
                  Passing score
                </label>
                <span className="mt-1 flex items-center gap-1">
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
                    className={`${INPUT_FRAME} min-h-10 w-20 text-base`}
                  />
                  <span aria-hidden className="text-slate-700">
                    %
                  </span>
                </span>
              </div>
              <button type="submit" className={button('secondary', 'sm')}>
                Save
              </button>
              <p className="basis-full text-xs text-slate-700">A student passes when their best finished run reaches this score.</p>
            </form>

            {summary.players.length === 0 ? (
              <p className="mt-3 text-sm text-slate-700">Nobody has joined yet. Share the code {code}.</p>
            ) : (
              <>
                <ul role="list" className="mt-2 divide-y divide-slate-100">
                  {summary.players.map((p) => (
                    <li key={p.id} className="flex flex-col gap-2 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 font-semibold wrap-break-word">{p.nickname}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${p.passed ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-800'}`}
                        >
                          {p.passed ? 'Passed' : 'Not yet'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">
                        {p.best ? (
                          <>
                            Best <strong className="text-slate-900">{p.best.percent}%</strong> ({p.best.correct}/{p.best.total})
                          </>
                        ) : (
                          'No finished run yet'
                        )}
                        {' · '}
                        {p.attempts} {p.attempts === 1 ? 'attempt' : 'attempts'}
                        {p.inProgress !== null && ` · playing now (${p.inProgress}/${summary.totalMessages})`}
                      </p>
                      {newCode?.playerId === p.id && (
                        <p aria-live="polite" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200">
                          New rejoin code for {newCode.nickname}:{' '}
                          <strong className="font-mono text-base tracking-widest">{newCode.code}</strong>. It’s shown only once.{' '}
                          <button type="button" onClick={() => setNewCode(null)} className={`rounded-sm font-semibold underline ${FOCUS_RING}`}>
                            Done
                          </button>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => resetCode(p)}
                          aria-label={`Reset code for ${p.nickname}`}
                          className={`rounded-lg border border-slate-400 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-sky-50 ${FOCUS_RING}`}
                        >
                          Reset code
                        </button>
                        <button
                          type="button"
                          onClick={() => removePlayer(p.id, p.nickname)}
                          aria-label={`Remove ${p.nickname}`}
                          className={`rounded-lg border border-slate-400 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-red-50 hover:text-red-800 ${FOCUS_RING}`}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => exportCsv(summary)} className={`${button('secondary', 'sm')} mt-3`}>
                  Export CSV
                </button>
              </>
            )}
          </Panel>

          <Panel icon={<FlagIcon className="size-5" />} title="Most-missed red flags" subtitle="From each student’s best finished run: red flags in phish they marked Legit.">
            {summary.mostMissedFlags.length === 0 ? (
              <p className="mt-3 text-sm text-slate-700">None yet.</p>
            ) : (
              <ol role="list" className="mt-2 divide-y divide-slate-100">
                {summary.mostMissedFlags.map(({ type, count }) => (
                  <li key={type} className="flex items-center justify-between gap-4 py-2.5">
                    <span>{FLAG_LABELS[type]}</span>
                    <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-800">
                      {count}
                      <span className="sr-only"> missed</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Per message" subtitle="Percent correct in each student’s best finished run.">
            <ol role="list" className="mt-2 divide-y divide-slate-100">
              {summary.perMessage.map((m, i) => (
                <li key={m.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-sm">
                      <span className="text-slate-700">
                        {i + 1}. {KIND_LABELS[m.kind]} ·{' '}
                        <span className={m.isPhish ? 'font-semibold text-red-800' : 'font-semibold text-emerald-800'}>
                          {m.isPhish ? 'Phish' : 'Legit'}
                        </span>{' '}
                        ·{' '}
                      </span>
                      <span className="wrap-break-word">{m.label}</span>
                    </p>
                    <p className="shrink-0 text-lg font-bold">
                      {m.percentCorrect === null ? '–' : `${m.percentCorrect}%`}
                      <span className="sr-only"> correct</span>
                    </p>
                  </div>
                  <div aria-hidden className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${m.percentCorrect ?? 0}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-700">
                    {m.answered} {m.answered === 1 ? 'answer' : 'answers'}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>

          <section aria-labelledby="danger-heading" className="rounded-2xl border border-red-200 bg-white p-5">
            <h3 id="danger-heading" className="text-lg font-bold">
              Delete this class
            </h3>
            <p className="mt-1 text-sm text-slate-700">
              Removes the class, its players, and all their answers right away. Students still playing will see that the
              class was closed.
            </p>
            <button type="button" onClick={deleteClass} className={`${DANGER_BUTTON} mt-3`}>
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
    <div className={`${CARD} p-3 sm:p-4`}>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-700 sm:text-sm">
        <span className="text-sky-800">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-black sm:text-3xl">{value}</dd>
    </div>
  );
}

type PanelProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  headingRef?: RefObject<HTMLHeadingElement | null>;
};

function Panel({ title, subtitle, icon, children, headingRef }: PanelProps) {
  return (
    <section className={`${CARD} p-4 sm:p-5`}>
      <h3 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="flex items-center gap-2 text-lg font-bold outline-none">
        {icon && <span className="text-sky-800">{icon}</span>}
        {title}
      </h3>
      {subtitle && <p className="mt-1 text-sm text-slate-700">{subtitle}</p>}
      {children}
    </section>
  );
}
