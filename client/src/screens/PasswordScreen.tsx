import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { button, CARD, FOCUS_RING, SECONDARY_BUTTON } from '../components/buttonStyles.ts';
import { CheckCircleIcon, LockIcon, XCircleIcon } from '../components/icons.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { generatePassphrase, loadWordlist } from '../password/passphrase.ts';
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
  // null means the wordlist couldn't be loaded.
  const [passphrase, setPassphrase] = useState<string[] | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
    // Start fetching the wordlist chunk now so it's ready when a check finishes.
    loadWordlist().catch(() => {});
    return () => requestRef.current?.abort();
  }, []);

  async function newPassphrase() {
    try {
      setPassphrase(generatePassphrase(await loadWordlist()));
    } catch {
      setPassphrase(null);
    }
  }

  function changePassword(value: string) {
    // A shown result describes the old value, so drop it (this doesn't run a check).
    requestRef.current?.abort();
    setPassword(value);
    setCheck({ status: 'idle' });
  }

  async function runCheck(e: FormEvent) {
    e.preventDefault();
    if (!password || check.status === 'checking') return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    const hash = await sha1Hex(password);
    if (controller.signal.aborted) return;
    setCheck({ status: 'checking', hash });
    try {
      const { breachCount, candidates } = await lookupHash(hash, controller.signal);
      await newPassphrase();
      if (controller.signal.aborted) return;
      setCheck({ status: 'done', hash, breachCount, candidates });
    } catch {
      if (!controller.signal.aborted) setCheck({ status: 'error', hash });
    }
  }

  return (
    <section aria-labelledby="password-heading" className="flex flex-col gap-6">
      <ScreenHeader id="password-heading" headingRef={headingRef} icon={<LockIcon className="size-6" />} title="Has this password leaked?" onBack={onBack}>
        Checks a password against passwords exposed in real data breaches, without sending the password anywhere.
      </ScreenHeader>

      <form onSubmit={runCheck} className={`${CARD} flex flex-col gap-5 p-5 sm:p-6`}>
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200">
          Don’t type your real password here, or into any site you don’t fully trust. Try one that’s like yours instead.
        </p>

        <div>
          <label htmlFor={inputId} className="text-sm font-semibold">
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
              className={`min-h-12 w-full min-w-0 rounded-lg border border-slate-500 px-3 font-mono text-base ${FOCUS_RING}`}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-controls={inputId}
              aria-label={visible ? 'Hide password' : 'Show password'}
              className={`min-h-12 shrink-0 rounded-lg border border-slate-400 px-4 text-sm font-semibold text-sky-900 hover:bg-sky-50 ${FOCUS_RING}`}
            >
              {visible ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-700">Try an example:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                changePassword(example);
                inputRef.current?.focus();
              }}
              className={`rounded-full border border-sky-800/25 bg-sky-50 px-3 py-1 font-mono text-sky-950 hover:bg-sky-100 ${FOCUS_RING}`}
            >
              {example}
            </button>
          ))}
        </div>

        <button type="submit" disabled={!password}
          aria-busy={check.status === 'checking'} className={`${button('primary', 'lg')} self-start`}>
          {check.status === 'checking' ? 'Checking…' : 'Check'}
        </button>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {check.status === 'done' &&
          (check.breachCount > 0 ? (
            <p className="flex items-start gap-3 rounded-2xl bg-red-50 px-4 py-3 text-red-900 ring-1 ring-red-200">
              <XCircleIcon className="mt-0.5 size-6 shrink-0" />
              <span>
                <strong className="block text-lg">Seen in data breaches {check.breachCount.toLocaleString()} times.</strong>
                Attackers try these first. Don’t use it.
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900 ring-1 ring-emerald-200">
              <CheckCircleIcon className="mt-0.5 size-6 shrink-0" />
              <span>
                <strong className="block text-lg">Not found in known breaches.</strong>
                That doesn’t mean it’s strong.
              </span>
            </p>
          ))}
        {check.status === 'error' && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-900 ring-1 ring-amber-200">
            <strong>Couldn’t reach the breach database.</strong> Check your connection and try again in a moment.
          </p>
        )}
      </div>

      {check.status !== 'idle' && <LeftDevicePanel check={check} />}

      {check.status === 'done' && (
        <section aria-labelledby="passphrase-heading" className={`${CARD} p-5 sm:p-6`}>
          <h3 id="passphrase-heading" className="text-lg font-bold">
            Try a passphrase instead
          </h3>
          <p className="mt-1 text-sm text-slate-700">Four random words are easier to remember and harder to guess.</p>
          {passphrase ? (
            <p className="mt-3 rounded-xl bg-sky-50 px-4 py-3 font-mono text-xl font-semibold text-sky-950 wrap-break-word ring-1 ring-sky-200">
              {passphrase.join(' ')}
            </p>
          ) : (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
              Couldn’t load the word list. Check your connection and try again.
            </p>
          )}
          <button type="button" onClick={newPassphrase} className={`${SECONDARY_BUTTON} mt-3`}>
            {passphrase ? 'Regenerate' : 'Try again'}
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
    <section aria-labelledby="left-device-heading" className={`${CARD} p-5 sm:p-6`}>
      <h3 id="left-device-heading" className="text-lg font-bold">
        What left this device
      </h3>
      <p className="mt-2 text-sm text-slate-700">Sent to Have I Been Pwned:</p>
      <p className="mt-1 font-mono text-2xl font-bold tracking-wider">{prefix}</p>

      <p className="mt-4 text-sm text-slate-700">The password’s full SHA-1 hash:</p>
      <p className="mt-1 font-mono text-sm break-all">
        <mark className="rounded bg-amber-200 px-0.5 text-inherit">{prefix}</mark>
        <span className="sr-only"> (sent) </span>
        <span className="text-slate-500">{rest}</span>
        <span className="sr-only"> (stayed on your device)</span>
      </p>
      <div aria-hidden className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm bg-amber-200" /> sent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm bg-slate-300" /> stayed on your device
        </span>
      </div>

      <p className="mt-4 text-sm text-slate-700">
        {check.status === 'done'
          ? `The service sent back ${check.candidates.toLocaleString()} hashes that start with ${prefix}. This device compared them to the rest of the hash; the password itself never left.`
          : check.status === 'checking'
            ? 'Waiting for the list of hashes that share this prefix…'
            : 'At most these 5 characters were sent. The password itself never left.'}
      </p>
    </section>
  );
}
