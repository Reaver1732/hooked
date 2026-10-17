import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CLASS_CODE_LENGTH, NICKNAME_MAX } from '../../../shared/api.ts';
import { api, ApiRequestError } from '../class/api.ts';
import { button, CARD, INPUT_FRAME, TEXT_INPUT } from '../components/buttonStyles.ts';
import { UsersIcon } from '../components/icons.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';

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
    if (busy) return; // not `disabled` while busy: that would drop keyboard focus
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
      <ScreenHeader id="join-heading" headingRef={headingRef} icon={<UsersIcon className="size-6" />} title="Join a class" onBack={onBack}>
        Enter the code your teacher shows you. Only your nickname and your answers are sent to your teacher.
      </ScreenHeader>

      <form onSubmit={join} className={`${CARD} flex flex-col gap-5 p-5 sm:p-6`}>
        <div>
          <label htmlFor={codeId} className="text-sm font-semibold">
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
            className={`${INPUT_FRAME} mt-1.5 min-h-16 text-center font-mono text-3xl font-bold tracking-[0.3em] text-sky-950 uppercase`}
          />
        </div>
        <div>
          <label htmlFor={nicknameId} className="text-sm font-semibold">
            Nickname
          </label>
          <p className="text-xs text-slate-700">Not your full name. Up to {NICKNAME_MAX} characters.</p>
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
        <div aria-live="polite" className="-mt-5">
          {error && (
            <p id={errorId} className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
              {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={code.length !== CLASS_CODE_LENGTH || !nickname.trim()}
          aria-busy={busy}
          className={`${button('primary', 'lg')} w-full sm:w-auto sm:self-start`}
        >
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
    </section>
  );
}
