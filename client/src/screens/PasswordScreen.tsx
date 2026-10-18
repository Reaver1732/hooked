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
  const resultRef = useRef<HTMLDivElement>(null);
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

  // A finished check: bring the verdict into view (on a phone it lands below the screen).
  // Instantly, so reduced motion is respected; only when it isn't fully visible already.
  useEffect(() => {
    if (check.status !== 'done' && check.status !== 'error') return;
    const box = resultRef.current?.getBoundingClientRect();
    if (box && (box.top < 0 || box.bottom > window.innerHeight)) {
      resultRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, [check.status]);

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
        See if a password has leaked online after a website was hacked. Your password never leaves your device.
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

      <div ref={resultRef} aria-live="polite" aria-atomic="true" className="scroll-mt-4">
        {check.status === 'done' &&
          (check.breachCount > 0 ? (
            <p className="hk-reveal-pop flex items-start gap-3 rounded-card bg-bad px-5 py-4 text-on-bad">
              <XCircleIcon className="mt-0.5 size-7 shrink-0" />
              <span>
                <strong className="hk-display block text-title">Found {check.breachCount.toLocaleString()} times in leaked password lists.</strong>
                Hackers try leaked passwords first. Don’t use this one.
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
            <strong>Couldn’t reach the leaked-password list.</strong> Your school’s network may block it. The game still works.
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
        Leaked-password data from{' '}
        <a href="https://haveibeenpwned.com/Passwords" target="_blank" rel="noopener noreferrer" className="hk-link text-ink">
          Have I Been Pwned
        </a>
        . Passphrase words from the{' '}
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
  // One line up front; the details are there for whoever asks (teachers like them).
  return (
    <section aria-labelledby="left-device-heading" className="hk-card p-5 sm:p-6">
      <p id="left-device-heading" className="text-card-ink">
        Only 5 characters of a scrambled code (<span className="font-code font-bold tracking-wider">{prefix}</span>) left
        your device.
      </p>
      <details className="mt-3">
        <summary className="hk-link w-fit cursor-pointer text-small">How does this keep my password secret?</summary>
        <p className="mt-3 text-small text-card-ink-muted">Sent to Have I Been Pwned:</p>
        <p className="mt-1 font-code text-title font-bold tracking-wider">{prefix}</p>

        <p className="mt-4 text-small text-card-ink-muted">
          Your device turned the password into a scrambled code called a hash. Only its first 5 characters were sent:
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
            ? `Have I Been Pwned sent back ${check.candidates.toLocaleString()} codes that start with ${prefix}. Your device checked them itself. Your password never left your device.`
            : check.status === 'checking'
              ? 'Checking the list…'
              : 'At most these 5 characters were sent. Your password never left your device.'}
        </p>
      </details>
    </section>
  );
}
