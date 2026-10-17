import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CLASS_CODE_LENGTH, NICKNAME_MAX } from '../../../shared/api.ts';
import { api, ApiRequestError } from '../class/api.ts';
import { BACK_LINK, PRIMARY_BUTTON, TEXT_INPUT } from '../components/buttonStyles.ts';

export type ClassSession = { code: string; nickname: string; playerId: string };

type Props = {
  onJoined: (session: ClassSession) => void;
  onBack: () => void;
  /** Filled in from a join link, so the student only needs a nickname. */
  initialCode?: string;
};

export function JoinScreen({ onJoined, onBack, initialCode = '' }: Props) {
  const codeId = useId();
  const nicknameId = useId();
  const errorId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialCode) nicknameRef.current?.focus();
    else headingRef.current?.focus({ preventScroll: true });
  }, [initialCode]);

  async function join(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { playerId } = await api.joinClass(code, nickname.trim());
      onJoined({ code, nickname: nickname.trim().replace(/\s+/g, ' '), playerId });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Couldn’t join the class.');
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="join-heading" className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className={BACK_LINK}>
        ← Back
      </button>
      <div>
        <h2 id="join-heading" ref={headingRef} tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none">
          Join a class
        </h2>
        <p className="mt-2 text-slate-600">
          Enter the code your teacher shows you. Only your nickname and your answers are sent to your teacher.
        </p>
      </div>

      <form onSubmit={join} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div>
          <label htmlFor={codeId} className="text-sm font-medium">
            Class code
          </label>
          <input
            id={codeId}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CLASS_CODE_LENGTH))}
            required
            minLength={CLASS_CODE_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby={error ? errorId : undefined}
            className={`${TEXT_INPUT} mt-1.5 font-mono text-2xl tracking-[0.3em] uppercase`}
          />
        </div>
        <div>
          <label htmlFor={nicknameId} className="text-sm font-medium">
            Nickname
          </label>
          <p className="text-xs text-slate-500">Not your full name. Up to {NICKNAME_MAX} characters.</p>
          <input
            ref={nicknameRef}
            id={nicknameId}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            maxLength={NICKNAME_MAX}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={error ? errorId : undefined}
            className={`${TEXT_INPUT} mt-1.5`}
          />
        </div>
        <div aria-live="polite">
          {error && (
            <p id={errorId} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
              {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={busy || code.length !== CLASS_CODE_LENGTH || !nickname.trim()}
          className={`${PRIMARY_BUTTON} self-start`}
        >
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
    </section>
  );
}
