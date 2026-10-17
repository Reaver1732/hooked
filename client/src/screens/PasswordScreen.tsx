import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { FOCUS_RING, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/buttonStyles.ts';
import { generatePassphrase } from '../password/passphrase.ts';
import { lookupHash, PREFIX_LENGTH, sha1Hex } from '../password/pwned.ts';

const EXAMPLES = ['password123', 'soccer2012', 'iloveyou'];

type Check =
  | { status: 'idle' }
  | { status: 'checking'; hash: string }
  | { status: 'done'; hash: string; breachCount: number; candidates: number }
  | { status: 'error'; hash: string };

/**
 * The password lives only in this component's state: it is never stored, logged or
 * sent, and it is discarded when the screen unmounts. Only the first 5 characters of
 * its SHA-1 hash go over the network.
 */
export function PasswordScreen({ onBack }: { onBack: () => void }) {
  const inputId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [check, setCheck] = useState<Check>({ status: 'idle' });
  const [passphrase, setPassphrase] = useState<string[]>([]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
    return () => requestRef.current?.abort();
  }, []);

  function changePassword(value: string) {
    // A shown result describes the old value, so drop it (this doesn't run a check).
    requestRef.current?.abort();
    setPassword(value);
    setCheck({ status: 'idle' });
  }

  async function runCheck(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    const hash = await sha1Hex(password);
    if (controller.signal.aborted) return;
    setCheck({ status: 'checking', hash });
    try {
      const { breachCount, candidates } = await lookupHash(hash, controller.signal);
      setCheck({ status: 'done', hash, breachCount, candidates });
      setPassphrase(generatePassphrase());
    } catch {
      if (!controller.signal.aborted) setCheck({ status: 'error', hash });
    }
  }

  return (
    <section aria-labelledby="password-heading" className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className={`self-start rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 ${FOCUS_RING}`}>
        ← Back
      </button>

      <div>
        <h2 id="password-heading" ref={headingRef} tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none">
          Has this password leaked?
        </h2>
        <p className="mt-2 text-slate-600">
          Checks a password against passwords exposed in real data breaches, without sending the password anywhere.
        </p>
      </div>

      <form onSubmit={runCheck} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
          Don’t type your real password here, or into any site you don’t fully trust. Try one that’s like yours instead.
        </p>

        <div>
          <label htmlFor={inputId} className="text-sm font-medium">
            Password to check
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              ref={inputRef}
              id={inputId}
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={(e) => changePassword(e.target.value)}
              autoComplete="new-password"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              // Ask password managers not to offer to save or fill this field.
              data-1p-ignore=""
              data-lpignore="true"
              data-bwignore=""
              data-form-type="other"
              className={`min-h-12 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-mono text-base ${FOCUS_RING}`}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-controls={inputId}
              aria-label={visible ? 'Hide password' : 'Show password'}
              className={`min-h-12 shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-100 ${FOCUS_RING}`}
            >
              {visible ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-600">Try an example:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                changePassword(example);
                inputRef.current?.focus();
              }}
              className={`rounded-full border border-slate-300 px-3 py-1 font-mono hover:bg-slate-100 ${FOCUS_RING}`}
            >
              {example}
            </button>
          ))}
        </div>

        <button type="submit" disabled={!password || check.status === 'checking'} className={`${PRIMARY_BUTTON} self-start`}>
          {check.status === 'checking' ? 'Checking…' : 'Check'}
        </button>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {check.status === 'done' &&
          (check.breachCount > 0 ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-red-900 ring-1 ring-red-200">
              <strong>Seen in data breaches {check.breachCount.toLocaleString()} times.</strong> Attackers try these
              first. Don’t use it.
            </p>
          ) : (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900 ring-1 ring-emerald-200">
              <strong>Not found in known breaches.</strong> That doesn’t mean it’s strong.
            </p>
          ))}
        {check.status === 'error' && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900 ring-1 ring-amber-200">
            <strong>Couldn’t reach the breach database.</strong> Check your connection and try again in a moment.
          </p>
        )}
      </div>

      {check.status !== 'idle' && <LeftDevicePanel check={check} />}

      {check.status === 'done' && (
        <section aria-labelledby="passphrase-heading" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 id="passphrase-heading" className="text-lg font-semibold">
            Try a passphrase instead
          </h3>
          <p className="mt-1 text-sm text-slate-600">Four random words are easier to remember and harder to guess.</p>
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2.5 font-mono text-lg break-all">{passphrase.join('-')}</p>
          <button type="button" onClick={() => setPassphrase(generatePassphrase())} className={`${SECONDARY_BUTTON} mt-3`}>
            Regenerate
          </button>
        </section>
      )}

    </section>
  );
}

function LeftDevicePanel({ check }: { check: Exclude<Check, { status: 'idle' }> }) {
  const prefix = check.hash.slice(0, PREFIX_LENGTH);
  const rest = check.hash.slice(PREFIX_LENGTH);
  return (
    <section aria-labelledby="left-device-heading" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h3 id="left-device-heading" className="text-lg font-semibold">
        What left this device
      </h3>
      <p className="mt-2 text-sm text-slate-600">Sent to Have I Been Pwned:</p>
      <p className="mt-1 font-mono text-2xl font-bold tracking-wider">{prefix}</p>

      <p className="mt-4 text-sm text-slate-600">The password’s full SHA-1 hash:</p>
      <p className="mt-1 font-mono text-sm break-all">
        <mark className="rounded bg-amber-200 px-0.5 text-inherit">{prefix}</mark>
        <span className="sr-only"> (sent) </span>
        <span className="text-slate-400">{rest}</span>
        <span className="sr-only"> (stayed on your device)</span>
      </p>
      <div aria-hidden className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm bg-amber-200" /> sent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm bg-slate-300" /> stayed on your device
        </span>
      </div>

      <p className="mt-4 text-sm text-slate-600">
        {check.status === 'done'
          ? `The service sent back ${check.candidates.toLocaleString()} hashes that start with ${prefix}. This device compared them to the rest of the hash; the password itself never left.`
          : check.status === 'checking'
            ? 'Waiting for the list of hashes that share this prefix…'
            : 'At most these 5 characters were sent. The password itself never left.'}
      </p>
    </section>
  );
}
