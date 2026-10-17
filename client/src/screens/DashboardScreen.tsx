import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { ClassSummary } from '../../../shared/api.ts';
import { FLAG_LABELS } from '../../../shared/flags.ts';
import { api, ApiRequestError } from '../class/api.ts';
import type { TeacherCredentials } from '../class/dashboardLink.ts';
import { FOCUS_RING } from '../components/buttonStyles.ts';

const REFRESH_MS = 5000;
const KIND_LABELS = { email: 'Email', text: 'Text', dm: 'DM' } as const;

export function DashboardScreen({ credentials }: { credentials: TeacherCredentials }) {
  const { code, teacherKey } = credentials;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const playersHeadingRef = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [summary, setSummary] = useState<ClassSummary | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // `fatal` stops polling (bad key, class gone); otherwise the last good data stays up.
  const [error, setError] = useState<{ message: string; fatal: boolean } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSummary(await api.summary(code, teacherKey));
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      const status = err instanceof ApiRequestError ? err.status : null;
      setError({
        message: err instanceof ApiRequestError ? err.message : 'Couldn’t load the class.',
        fatal: status === 401 || status === 404,
      });
    }
  }, [code, teacherKey]);

  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);

  // Poll every 5 s, one request at a time, and skip while the tab is hidden.
  const fatal = error?.fatal ?? false;
  useEffect(() => {
    if (fatal) return;
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
  }, [refresh, fatal]);

  async function removePlayer(id: string, nickname: string) {
    if (!window.confirm(`Remove “${nickname}” from the class? Their answers will be deleted.`)) return;
    try {
      await api.removePlayer(code, teacherKey, id);
      await refresh();
      // The focused Remove button is gone now; say what happened and keep focus in the list.
      setNotice(`Removed ${nickname}.`);
      playersHeadingRef.current?.focus();
    } catch (err) {
      setError({ message: err instanceof ApiRequestError ? err.message : 'Couldn’t remove that player.', fatal: false });
    }
  }

  return (
    <section aria-labelledby="dashboard-heading" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="dashboard-heading" ref={headingRef} tabIndex={-1} className="text-sm font-medium text-slate-600 outline-none">
            Teacher dashboard
          </h2>
          <p className="font-mono text-5xl font-bold tracking-[0.15em]">{code}</p>
        </div>
        <p className="text-xs text-slate-500" aria-live="off">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()} · refreshes every 5 s` : 'Loading…'}
        </p>
      </div>

      <div aria-live="polite">
        {error && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            {error.message}
            {!error.fatal && summary && ' Showing the last results; retrying.'}
          </p>
        )}
      </div>

      {summary && (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Players" value={String(summary.playerCount)} />
            <Stat
              label="Average score"
              value={summary.averageCorrect === null ? '–' : `${summary.averageCorrect.toFixed(1)} / ${summary.totalMessages}`}
            />
          </dl>

          <Panel title="Most-missed red flags" subtitle="Red flags in phish that students marked Legit.">
            {summary.mostMissedFlags.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">None yet.</p>
            ) : (
              <ol role="list" className="mt-2 divide-y divide-slate-100">
                {summary.mostMissedFlags.map(({ type, count }) => (
                  <li key={type} className="flex items-center justify-between gap-4 py-2">
                    <span>{FLAG_LABELS[type]}</span>
                    <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-semibold text-red-800">
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
                <li key={m.id} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-sm">
                      <span className="text-slate-500">
                        {i + 1}. {KIND_LABELS[m.kind]} · {m.isPhish ? 'Phish' : 'Legit'} ·{' '}
                      </span>
                      <span className="wrap-break-word">{m.label}</span>
                    </p>
                    <p className="shrink-0 text-sm font-semibold">
                      {m.percentCorrect === null ? '–' : `${m.percentCorrect}%`}
                      <span className="sr-only"> correct</span>
                    </p>
                  </div>
                  <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${m.percentCorrect ?? 0}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {m.answered} {m.answered === 1 ? 'answer' : 'answers'}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Players" headingRef={playersHeadingRef}>
            <p aria-live="polite" className="text-sm text-slate-600 empty:hidden">
              {notice}
            </p>
            {summary.players.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Nobody has joined yet. Share the code {code}.</p>
            ) : (
              <ul role="list" className="mt-2 divide-y divide-slate-100">
                {summary.players.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 wrap-break-word">{p.nickname}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-sm text-slate-600">
                        {p.correct} / {p.answered}
                        <span className="sr-only"> correct</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removePlayer(p.id, p.nickname)}
                        aria-label={`Remove ${p.nickname}`}
                        className={`rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-red-50 hover:text-red-800 ${FOCUS_RING}`}
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-1 text-3xl font-bold">{value}</dd>
    </div>
  );
}

type PanelProps = { title: string; subtitle?: string; children: ReactNode; headingRef?: RefObject<HTMLHeadingElement | null> };

function Panel({ title, subtitle, children, headingRef }: PanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h3 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="text-lg font-semibold outline-none">
        {title}
      </h3>
      {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      {children}
    </section>
  );
}
