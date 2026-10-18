import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react';
import { CLASS_CODE_LENGTH, NICKNAME_MAX, REJOIN_CODE_LENGTH } from '../../../shared/api.ts';
import { api, ApiRequestError } from '../class/api.ts';
import { forgetPlayer, storedPlayer, type StoredPlayer } from '../class/storage.ts';
import { UsersIcon } from '../components/icons.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { button, Notice, TextButton } from '../design/parts.tsx';

export type ClassSession = { code: string; nickname: string; playerId: string };

type Props = {
  /** `rejoinCode` is set only for a brand-new player, to be shown to them once. */
  onJoined: (session: ClassSession, rejoinCode?: string) => void;
  onBack: () => void;
  /** Filled in from a join link, so the student only needs a nickname. */
  initialCode?: string;
};

const cleanCode = (value: string, length: number) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length);
const CODE_INPUT = 'hk-input mt-2 min-h-16 text-center font-code text-title font-bold tracking-[0.3em] uppercase';
const LABEL = 'text-small font-bold';
const FORM = 'hk-card flex flex-col gap-5 p-5 sm:p-6';

export function JoinScreen({ onJoined, onBack, initialCode = '' }: Props) {
  const codeId = useId();
  const nicknameId = useId();
  const rejoinCodeId = useId();
  const errorId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const rejoinFirstRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'join' | 'rejoin'>('join');
  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState('');
  const [rejoinCode, setRejoinCode] = useState('');
  const [saved, setSaved] = useState<StoredPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "No such class" belongs to the Class code field, so it's shown there, not under Nickname.
  const [codeError, setCodeError] = useState<string | null>(null);
  const codeErrorId = useId();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialCode) nicknameRef.current?.focus();
    else headingRef.current?.focus({ preventScroll: true });
  }, [initialCode]);

  // A player this browser remembers for this class? Offer it only if the server agrees
  // they still exist; otherwise forget them.
  useEffect(() => {
    setSaved(null);
    if (code.length !== CLASS_CODE_LENGTH) return;
    const remembered = storedPlayer(code);
    if (!remembered) return;
    let cancelled = false;
    api.player(remembered.playerId).then(
      (progress) => {
        if (cancelled) return;
        setSaved({ ...remembered, nickname: progress.nickname });
      },
      (err) => {
        if (!cancelled && err instanceof ApiRequestError && err.status === 404) forgetPlayer(code);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Arriving from a join link and nothing typed yet: go straight to "Continue as".
  useEffect(() => {
    // Runs only when the offer appears, not on every keystroke.
    if (saved && document.activeElement === nicknameRef.current && !nickname) continueRef.current?.focus();
  }, [saved]);

  useEffect(() => {
    if (mode === 'rejoin') rejoinFirstRef.current?.focus();
  }, [mode]);

  async function run(action: () => Promise<void>, fallback: string) {
    if (busy) return; // not `disabled` while busy: that would drop keyboard focus
    setError(null);
    setCodeError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) {
        setCodeError(`We couldn’t find class ${code}. Check the code on the board and try again.`);
      } else {
        setError(err instanceof ApiRequestError ? err.message : fallback);
      }
      setBusy(false);
    }
  }

  const join = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const joined = await api.joinClass(code, nickname.trim());
      onJoined({ code, nickname: joined.nickname, playerId: joined.playerId }, joined.rejoinCode);
    }, 'Couldn’t join the class.');
  };

  const rejoin = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const player = await api.rejoinClass(code, nickname.trim(), rejoinCode);
      onJoined({ code, nickname: player.nickname, playerId: player.playerId });
    }, 'Couldn’t rejoin the class.');
  };

  const errorBox = (
    <div aria-live="polite" className="-mt-5">
      {error && (
        <div className="mt-5">
          <Notice tone="error" id={errorId}>
            {error}
          </Notice>
        </div>
      )}
    </div>
  );
  const describedBy = error ? errorId : undefined;

  const codeField = (ref?: Ref<HTMLInputElement>) => (
    <div>
      <label htmlFor={codeId} className={LABEL}>
        Class code
      </label>
      <input
        ref={ref}
        id={codeId}
        value={code}
        onChange={(e) => {
          setCode(cleanCode(e.target.value, CLASS_CODE_LENGTH));
          setCodeError(null);
        }}
        required
        minLength={CLASS_CODE_LENGTH}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-invalid={codeError ? true : undefined}
        aria-describedby={[codeError ? codeErrorId : '', describedBy ?? ''].join(' ').trim() || undefined}
        className={CODE_INPUT}
      />
      <div aria-live="polite">
        {codeError && (
          <div className="mt-2">
            <Notice tone="error" id={codeErrorId}>
              {codeError}
            </Notice>
          </div>
        )}
      </div>
    </div>
  );

  const nicknameField = (
    <div>
      <label htmlFor={nicknameId} className={LABEL}>
        Nickname
      </label>
      <p className="text-micro text-card-ink-muted">
        {mode === 'join' ? `Not your full name. Up to ${NICKNAME_MAX} characters.` : 'The nickname you joined with.'}
      </p>
      <input
        ref={nicknameRef}
        id={nicknameId}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        required
        maxLength={NICKNAME_MAX}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={describedBy}
        className="hk-input mt-2"
      />
    </div>
  );

  return (
    <section aria-labelledby="join-heading" className="flex flex-col gap-6">
      <ScreenHeader id="join-heading" headingRef={headingRef} icon={<UsersIcon className="size-6" />} title={mode === 'join' ? 'Join a class' : 'Rejoin a class'} onBack={onBack}>
        {mode === 'join'
          ? 'Enter the code your teacher shows you. Only your nickname and your answers are sent to your teacher.'
          : 'Playing on another device? Enter your class code, nickname, and the rejoin code you wrote down.'}
      </ScreenHeader>

      {mode === 'join' ? (
        <form onSubmit={join} className={FORM}>
          {codeField()}

          <div aria-live="polite" className="-mt-5">
            {saved && (
              <div className="mt-5 rounded-control bg-surface-muted p-4">
                <p className="text-small">
                  You’ve played in this class on this device as <strong>{saved.nickname}</strong>.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    ref={continueRef}
                    type="button"
                    onClick={() => onJoined({ code, nickname: saved.nickname, playerId: saved.playerId })}
                    className={button('primary')}
                  >
                    Continue as {saved.nickname}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaved(null);
                      nicknameRef.current?.focus();
                    }}
                    className={button('secondary')}
                  >
                    Join as someone new
                  </button>
                </div>
              </div>
            )}
          </div>

          {nicknameField}
          {errorBox}
          <button
            type="submit"
            disabled={code.length !== CLASS_CODE_LENGTH || !nickname.trim()}
            aria-busy={busy}
            className={`${button('primary', 'lg')} w-full sm:w-auto sm:self-start`}
          >
            {busy ? 'Joining…' : 'Join'}
          </button>
        </form>
      ) : (
        <form onSubmit={rejoin} className={FORM}>
          {codeField(rejoinFirstRef)}
          {nicknameField}
          <div>
            <label htmlFor={rejoinCodeId} className={LABEL}>
              Rejoin code
            </label>
            <input
              id={rejoinCodeId}
              value={rejoinCode}
              onChange={(e) => setRejoinCode(cleanCode(e.target.value, REJOIN_CODE_LENGTH))}
              required
              minLength={REJOIN_CODE_LENGTH}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-describedby={describedBy}
              className={CODE_INPUT}
            />
          </div>
          {errorBox}
          <button
            type="submit"
            disabled={code.length !== CLASS_CODE_LENGTH || !nickname.trim() || rejoinCode.length !== REJOIN_CODE_LENGTH}
            aria-busy={busy}
            className={`${button('primary', 'lg')} w-full sm:w-auto sm:self-start`}
          >
            {busy ? 'Rejoining…' : 'Rejoin'}
          </button>
        </form>
      )}

      <p className="text-small text-ink-muted">
        {mode === 'join' ? 'Joined this class before? ' : 'First time in this class? '}
        <TextButton
          onClick={() => {
            setError(null);
            setCodeError(null);
            setMode(mode === 'join' ? 'rejoin' : 'join');
          }}
          className="text-ink"
        >
          {mode === 'join' ? 'Use your rejoin code' : 'Join as a new player'}
        </TextButton>
      </p>
    </section>
  );
}
