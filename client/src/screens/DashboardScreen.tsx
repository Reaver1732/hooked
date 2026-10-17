import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { CLASS_IDLE_DAYS, type ClassSummary } from '../../../shared/api.ts';
import { FLAG_LABELS } from '../../../shared/flags.ts';
import { api, ApiRequestError } from '../class/api.ts';
import type { TeacherCredentials } from '../class/dashboardLink.ts';
import { button, CARD, DANGER_BUTTON, FOCUS_RING, PRIMARY_BUTTON } from '../components/buttonStyles.ts';
import { ClockIcon, FlagIcon, FishIcon, TrashIcon, UsersIcon } from '../components/icons.tsx';

const REFRESH_MS = 5000;
const WARN_MS = 24 * 60 * 60 * 1000;
const KIND_LABELS = { email: 'Email', text: 'Text', dm: 'DM' } as const;

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );

export function DashboardScreen({ credentials }: { credentials: TeacherCredentials }) {
  const { code, teacherKey } = credentials;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const playersHeadingRef = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [summary, setSummary] = useState<ClassSummary | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [keptOnLoad, setKeptOnLoad] = useState(false);
  const [keeping, setKeeping] = useState(false);
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

  // Once the class is gone the key in the address bar is useless; drop it.
  useEffect(() => {
    if (!gone) return;
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
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2 id="dashboard-heading" ref={headingRef} tabIndex={-1} className="text-sm font-semibold tracking-wide text-sky-100 uppercase outline-none">
              Teacher dashboard
            </h2>
            <p className="font-mono text-5xl font-black tracking-[0.12em]">
              <span className="sr-only">Class code </span>
              {code}
            </p>
          </div>
          <p className="text-xs text-sky-100" aria-live="off">
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()} · refreshes every 5 s` : 'Loading…'}
          </p>
        </div>
      </div>

      {/* Live region stays mounted (so it announces) but takes no space while empty. */}
      <div aria-live="polite" className="-mt-5">
        {error && (
          <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            {error.message}
            {!error.fatal && summary && ' Showing the last results; retrying.'}
          </p>
        )}
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

          <dl className="grid grid-cols-2 gap-3">
            <Stat icon={<UsersIcon className="size-5" />} label="Players" value={String(summary.playerCount)} />
            <Stat
              icon={<FishIcon className="size-5" />}
              label="Average score"
              value={summary.averageCorrect === null ? '–' : `${summary.averageCorrect.toFixed(1)} / ${summary.totalMessages}`}
            />
          </dl>

          <Panel icon={<FlagIcon className="size-5" />} title="Most-missed red flags" subtitle="Red flags in phish that students marked Legit.">
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

          <Panel title="Per message" subtitle="Percent of students who answered correctly.">
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

          <Panel icon={<UsersIcon className="size-5" />} title="Players" headingRef={playersHeadingRef}>
            <p aria-live="polite" className="mt-1 text-sm text-slate-700 empty:hidden">
              {notice}
            </p>
            {summary.players.length === 0 ? (
              <p className="mt-3 text-sm text-slate-700">Nobody has joined yet. Share the code {code}.</p>
            ) : (
              <ul role="list" className="mt-2 divide-y divide-slate-100">
                {summary.players.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 font-medium wrap-break-word">{p.nickname}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-sm text-slate-700">
                        {p.correct} / {p.answered}
                        <span className="sr-only"> correct</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removePlayer(p.id, p.nickname)}
                        aria-label={`Remove ${p.nickname}`}
                        className={`rounded-lg border border-slate-400 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-red-50 hover:text-red-800 ${FOCUS_RING}`}
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
    <div className={`${CARD} p-4`}>
      <dt className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <span className="text-sky-800">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-3xl font-black">{value}</dd>
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
