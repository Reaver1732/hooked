import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CheckCircleIcon, LockIcon, XCircleIcon } from '../components/icons.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { button, Notice } from '../design/parts.tsx';
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
      <ScreenHeader id="password-heading" headingRef={headingRef} icon={<LockIcon className="size-7" />} title="Has this password leaked?" onBack={onBack}>
        Checks a password against passwords exposed in real data breaches, without sending the password anywhere.
      </ScreenHeader>

      <form onSubmit={runCheck} className="hk-card flex flex-col gap-5 p-5 sm:p-6">
        <p className="rounded-control border-2 border-mark bg-surface-muted px-4 py-3 text-small">
          Don’t type your real password here, or into any site you don’t fully trust. Try one that’s like yours instead.
        </p>

        <div>
          <label htmlFor={inputId} className="text-small font-bold">
            Password to check
          </label>
          <div className="mt-2 flex gap-3">
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
              className="hk-input font-code"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-controls={inputId}
              aria-label={visible ? 'Hide password' : 'Show password'}
              className={`${button('secondary')} shrink-0`}
            >
              {visible ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-small">
          <span className="text-card-ink-muted">Try an example:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                changePassword(example);
                inputRef.current?.focus();
              }}
              className="hk-focus rounded-full border-2 border-line bg-surface-muted px-3 py-1 font-code hover:border-card-ink-muted"
            >
              {example}
            </button>
          ))}
        </div>

        <button type="submit" disabled={!password} aria-busy={check.status === 'checking'} className={`${button('primary', 'lg')} self-start`}>
          {check.status === 'checking' ? 'Checking…' : 'Check'}
        </button>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {check.status === 'done' &&
          (check.breachCount > 0 ? (
            <p className="hk-reveal-pop flex items-start gap-3 rounded-card bg-bad px-5 py-4 text-on-bad">
              <XCircleIcon className="mt-0.5 size-7 shrink-0" />
              <span>
                <strong className="hk-display block text-title">Seen in data breaches {check.breachCount.toLocaleString()} times.</strong>
                Attackers try these first. Don’t use it.
              </span>
            </p>
          ) : (
            <p className="hk-reveal-pop flex items-start gap-3 rounded-card bg-good px-5 py-4 text-on-good">
              <CheckCircleIcon className="mt-0.5 size-7 shrink-0" />
              <span>
                <strong className="hk-display block text-title">Not found in known breaches.</strong>
                That doesn’t mean it’s strong.
              </span>
            </p>
          ))}
        {check.status === 'error' && (
          <Notice tone="error">
            <strong>Couldn’t reach the breach database.</strong> Check your connection and try again in a moment.
          </Notice>
        )}
      </div>

      {check.status !== 'idle' && <LeftDevicePanel check={check} />}

      {check.status === 'done' && (
        <section aria-labelledby="passphrase-heading" className="hk-card p-5 sm:p-6">
          <h3 id="passphrase-heading" className="hk-display text-heading">
            Try a passphrase instead
          </h3>
          <p className="mt-2 text-small text-card-ink-muted">Five random words are easier to remember and harder to guess.</p>
          {passphrase ? (
            <p className="mt-4 rounded-control bg-surface-muted px-4 py-3 font-code text-heading font-bold wrap-break-word">
              {passphrase.join(' ')}
            </p>
          ) : (
            <div className="mt-4">
              <Notice tone="error">Couldn’t load the word list. Check your connection and try again.</Notice>
            </div>
          )}
          <button type="button" onClick={newPassphrase} className={`${button('secondary')} mt-4`}>
            {passphrase ? 'New words' : 'Try again'}
          </button>
        </section>
      )}

      <p className="text-center text-micro text-ink-muted">
        Breach data from the{' '}
        <a href="https://haveibeenpwned.com/Passwords" target="_blank" rel="noopener noreferrer" className="hk-link text-ink">
          Have I Been Pwned
        </a>{' '}
        Pwned Passwords API. Passphrase words from the{' '}
        <a href="https://www.eff.org/dice" target="_blank" rel="noopener noreferrer" className="hk-link text-ink">
          EFF Short Wordlist
        </a>
        , with some words removed for school use.
      </p>
    </section>
  );
}

function LeftDevicePanel({ check }: { check: Exclude<Check, { status: 'idle' }> }) {
  const prefix = check.hash.slice(0, PREFIX_LENGTH);
  // The rest of the hash is never shown: an unsalted SHA-1 of a breached password can be
  // looked up, so a screenshot or a projector would give the password away.
  const restLength = check.hash.length - PREFIX_LENGTH;
  return (
    <section aria-labelledby="left-device-heading" className="hk-card p-5 sm:p-6">
      <h3 id="left-device-heading" className="hk-display text-heading">
        What left this device
      </h3>
      <p className="mt-3 text-small text-card-ink-muted">Sent to Have I Been Pwned:</p>
      <p className="mt-1 font-code text-title font-bold tracking-wider">{prefix}</p>

      <p className="mt-4 text-small text-card-ink-muted">
        The password’s SHA-1 hash (the other {restLength} characters never leave this device):
      </p>
      <p className="mt-1 font-code text-small break-all">
        <mark className="rounded-tight bg-primary px-0.5 text-on-primary">{prefix}</mark>
        <span className="sr-only"> (sent) </span>
        <span aria-hidden className="text-card-ink-muted">
          {'•'.repeat(restLength)}
        </span>
        <span className="sr-only"> and {restLength} more characters that stayed on your device</span>
      </p>
      <div aria-hidden className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-micro text-card-ink-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block size-3 rounded-tight bg-primary" /> sent
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-3 rounded-tight bg-line" /> stayed on your device
        </span>
      </div>

      <p className="mt-4 text-small text-card-ink-muted">
        {check.status === 'done'
          ? `The service sent back ${check.candidates.toLocaleString()} hashes that start with ${prefix}. This device compared them to the rest of the hash; the password itself never left.`
          : check.status === 'checking'
            ? 'Waiting for the list of hashes that share this prefix…'
            : 'At most these 5 characters were sent. The password itself never left.'}
      </p>
    </section>
  );
}
