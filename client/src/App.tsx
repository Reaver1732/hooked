import { useCallback, useEffect, useRef, useState } from 'react';
import { messages, quickRoundMessages, type Message } from '../../shared/messages.ts';
import { api, ApiRequestError } from './class/api.ts';
import { dashboardHash, readDashboardHash, type TeacherCredentials } from './class/dashboardLink.ts';
import { takeJoinParam } from './class/joinLink.ts';
import {
  activeSession,
  forgetActiveSession,
  forgetClass,
  forgetPlayer,
  rememberActiveSession,
  rememberClass,
  rememberPlayer,
} from './class/storage.ts';
import type { Answer } from './game/types.ts';
import { Notice, Wordmark } from './design/parts.tsx';
import { DashboardScreen } from './screens/DashboardScreen.tsx';
import { JoinScreen, type ClassSession } from './screens/JoinScreen.tsx';
import { PasswordScreen } from './screens/PasswordScreen.tsx';
import { PlayScreen } from './screens/PlayScreen.tsx';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { StartScreen, type StartScreenProps } from './screens/StartScreen.tsx';
import { TEACHER_GUIDE_HASH, TeacherGuideScreen } from './screens/TeacherGuideScreen.tsx';
import { TeacherScreen } from './screens/TeacherScreen.tsx';

type GameScreen =
  | { name: 'start' }
  | { name: 'play'; deck: Message[]; initialAnswers?: Answer[]; quick?: boolean }
  | { name: 'results'; answers: Answer[]; quick?: boolean };

type Screen =
  | GameScreen
  | { name: 'password'; back: GameScreen }
  | { name: 'join'; initialCode?: string }
  | { name: 'teacher' }
  | { name: 'dashboard'; credentials: TeacherCredentials }
  | { name: 'guide'; back: Screen };

function initialScreen(): Screen {
  const credentials = readDashboardHash();
  if (credentials) return { name: 'dashboard', credentials };
  if (window.location.hash === TEACHER_GUIDE_HASH) return { name: 'guide', back: { name: 'start' } };

  // A join link or QR code: <site>/?join=CODE
  const joinCode = takeJoinParam();
  if (joinCode) return { name: 'join', initialCode: joinCode };

  // <site>/?quick=1 starts the 5-message quick round (solo only, so not when this tab is in a class).
  if (new URLSearchParams(window.location.search).get('quick') === '1' && !activeSession()) {
    return { name: 'play', deck: quickRoundMessages(), quick: true };
  }

  // Dev-only preview: ?msg=<id> opens that message directly. import.meta.env.DEV is
  // replaced with `false` in production builds, so this whole branch is dropped.
  if (import.meta.env.DEV) {
    const id = new URLSearchParams(window.location.search).get('msg');
    if (id) {
      const message = messages.find((m) => m.id === id);
      if (message) return { name: 'play', deck: [message] };
      console.warn(`?msg=${id} matches no message. Known ids: ${messages.map((m) => m.id).join(', ')}`);
    }
  }
  return { name: 'start' };
}

// Each screen's column width; the header lines up with it.
const SCREEN_WIDTHS: Record<Screen['name'], string> = {
  start: 'max-w-6xl',
  play: 'max-w-6xl',
  results: 'max-w-4xl',
  dashboard: 'max-w-4xl',
  teacher: 'max-w-3xl',
  guide: 'max-w-3xl',
  join: 'max-w-2xl',
  password: 'max-w-2xl',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type AnswerBody = Parameters<typeof api.submitAnswer>[0];

/** Network errors and server errors may pass; anything else (404, 429, …) won't on a retry. */
const isRetryable = (err: unknown) => !(err instanceof ApiRequestError) || err.status === null || err.status >= 500;

/**
 * Starts (or resumes) a class attempt, trying again twice (after 0.5 s and 1 s) on network or
 * server errors, so one blip doesn't turn the whole round into an uncounted solo round.
 */
async function startAttemptWithRetry(playerId: string) {
  for (let tryNo = 0; ; tryNo++) {
    try {
      return await api.startAttempt(playerId);
    } catch (err) {
      if (tryNo >= 2 || !isRetryable(err)) throw err;
      await sleep(500 * 2 ** tryNo);
    }
  }
}

/** Shown while answers are waiting to be re-sent. Cleared once they all get through. */
const QUEUED_MESSAGE = 'Some answers haven’t reached your class yet. Keep this page open and they’ll be sent.';
/** How often queued answers are re-sent. */
const RESEND_MS = 5000;

/**
 * Rebuilds the answers a resumed attempt already has, in deck order. Stops at the first
 * unanswered message, which is where play resumes (answers are given in order).
 */
function resumedAnswers(saved: { messageId: string; choice: 'phish' | 'legit' }[]): Answer[] {
  const choices = new Map(saved.map((a) => [a.messageId, a.choice]));
  const answers: Answer[] = [];
  for (const message of messages) {
    const choice = choices.get(message.id);
    if (!choice) break;
    answers.push({ message, guessedPhish: choice === 'phish' });
  }
  return answers;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [round, setRound] = useState(0);
  // Restored from this tab's sessionStorage, so a refresh stays in the class.
  const [session, setSession] = useState<ClassSession | null>(activeSession);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** A new player's rejoin code, shown once on the start screen. */
  const [rejoinCode, setRejoinCode] = useState<string | null>(null);
  /**
   * Answers that failed every quick retry, keyed by attempt and message. They're re-sent on a
   * timer, when the browser comes back online, and before the next round starts. Re-sending is
   * safe: the server keeps only the first answer to each message in an attempt.
   */
  const queuedRef = useRef(new Map<string, { code: string; body: AnswerBody }>());
  const flushingRef = useRef(false);
  /** Answers being sent right now, so the next round can wait for them. */
  const inFlightRef = useRef(new Set<Promise<void>>());
  /** Answers still being sent to the class (Results waits on these before saying they arrived). */
  const [pendingSends, setPendingSends] = useState(0);
  /** The class attempt answers are reported to (set when a class round starts). */
  const attemptIdRef = useRef<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const isFirstScreen = useRef(true);

  // Most screens move focus to their own heading on mount. If a screen change left
  // focus on <body> (the focused control was unmounted), put it on the new screen's
  // heading so keyboard and screen-reader users aren't dropped at the top of the page.
  // Child effects run before this one, so screens that manage focus themselves win.
  useEffect(() => {
    if (isFirstScreen.current) {
      isFirstScreen.current = false;
      return;
    }
    if (document.activeElement && document.activeElement !== document.body) return;
    mainRef.current?.querySelector<HTMLElement>('h1[tabindex], h2[tabindex]')?.focus({ preventScroll: true });
  }, [screen]);

  // Keep this tab's stored session in step: joining saves it; Leave class, a closed class,
  // or a "player not found" all clear `session`, and that clears it here too.
  useEffect(() => {
    if (session) rememberActiveSession(session);
    else forgetActiveSession();
  }, [session]);

  // The dashboard and the guide each have their own hash, so browser Back and Forward move
  // between them and the screen they were opened from. A dashboard link pasted into an
  // already-open tab also arrives here.
  useEffect(() => {
    const onHashChange = () => {
      const credentials = readDashboardHash();
      if (credentials) setScreen({ name: 'dashboard', credentials });
      else if (window.location.hash === TEACHER_GUIDE_HASH) setScreen((s) => (s.name === 'guide' ? s : { name: 'guide', back: s }));
      // The hash went away (browser Back): leave the dashboard or the guide.
      else setScreen((s) => (s.name === 'dashboard' ? { name: 'start' } : s.name === 'guide' ? s.back : s));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // The class went away (teacher deleted it, or it expired): drop back to solo play.
  const closeSession = useCallback((code: string) => {
    forgetPlayer(code);
    setSession(null);
    setSyncError(null);
    setNotice('This class was closed. You can keep playing on your own.');
  }, []);

  /**
   * After a 404 for this player, the player is gone either way, so leave the class: nothing more
   * is sent for this round, and the header and results stop naming the class. The status
   * check only picks the wording ("class closed" or "you were removed").
   */
  const explainMissingPlayer = useCallback(
    async (code: string, removedMessage: string) => {
      attemptIdRef.current = null;
      try {
        await api.classStatus(code);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) {
          closeSession(code);
          return;
        }
      }
      forgetPlayer(code);
      setSession(null);
      setSyncError(removedMessage);
    },
    [closeSession],
  );

  /** One try at sending an answer: 'done' (sent, or no point retrying) or 'retry'. */
  const trySend = useCallback(
    async (code: string, body: AnswerBody, { queued = false } = {}): Promise<'done' | 'retry'> => {
      try {
        await api.submitAnswer(body);
        return 'done';
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) {
          await explainMissingPlayer(code, err.message);
          return 'done';
        }
        if (err instanceof ApiRequestError && err.status !== null && err.status < 500) {
          // A queued answer can arrive after its attempt finished; that's not worth an error.
          if (!(queued && err.status === 409)) setSyncError(err.message);
          return 'done';
        }
        return 'retry';
      }
    },
    [explainMissingPlayer],
  );

  /** Re-sends queued answers in order, stopping at the first that still can't get through. */
  const flushQueued = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const queued = queuedRef.current;
      for (const [key, { code, body }] of [...queued]) {
        if ((await trySend(code, body, { queued: true })) === 'retry') break;
        queued.delete(key);
      }
      if (queued.size === 0) setSyncError((e) => (e === QUEUED_MESSAGE ? null : e));
    } finally {
      flushingRef.current = false;
    }
  }, [trySend]);

  useEffect(() => {
    const resend = () => {
      if (queuedRef.current.size) void flushQueued();
    };
    const timer = window.setInterval(resend, RESEND_MS);
    window.addEventListener('online', resend);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', resend);
    };
  }, [flushQueued]);

  const play = async () => {
    let initialAnswers: Answer[] = [];
    // Let the last round's answers land first (in flight, then queued), so that round can
    // finish before the next one starts; otherwise the server would resume the old attempt.
    await Promise.allSettled([...inFlightRef.current]);
    if (queuedRef.current.size) await flushQueued();
    attemptIdRef.current = null;
    setSyncError(null);
    setNotice(null);
    if (session) {
      try {
        // Resumes the unfinished attempt (if any) or starts a new one.
        const attempt = await startAttemptWithRetry(session.playerId);
        attemptIdRef.current = attempt.attemptId;
        initialAnswers = resumedAnswers(attempt.answers);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) {
          await explainMissingPlayer(session.code, 'You’re no longer in this class. Join again, or keep playing on your own.');
          return;
        }
        // The server said no for a reason (e.g. too many requests): say what it said and stay
        // here, rather than blaming the connection and starting a round that won't count.
        if (err instanceof ApiRequestError && err.status !== null && err.status < 500) {
          setSyncError(err.message);
          return;
        }
        setSyncError('Couldn’t reach your class, so this round won’t count for it. Check your connection.');
      }
    }
    setRound((r) => r + 1);
    if (initialAnswers.length >= messages.length) setScreen({ name: 'results', answers: initialAnswers });
    else setScreen({ name: 'play', deck: messages, initialAnswers });
  };
  // The quick round is solo only: no attempt, nothing reported, and never offered in a class.
  const playQuick = () => {
    if (session) return;
    attemptIdRef.current = null;
    setSyncError(null);
    setNotice(null);
    setRound((r) => r + 1);
    setScreen({ name: 'play', deck: quickRoundMessages(), quick: true });
  };
  const openPasswordCheck = (back: GameScreen) => setScreen({ name: 'password', back });
  // True while the guide's history entry was added by the app, so its Back button can undo it.
  const guidePushedRef = useRef(false);
  // Opening the guide adds its hash to history; the hashchange handler shows it, with the
  // current screen to go back to.
  const openGuide = () => {
    guidePushedRef.current = true;
    window.location.hash = TEACHER_GUIDE_HASH;
  };

  // The header wordmark goes back to the start screen. Mid-round, check first.
  const goToStart = () => {
    if (
      screen.name === 'play' &&
      !window.confirm(
        session
          ? 'Go back to the start? Your answers so far are saved for your class, and Start picks up where you left off.'
          : 'Go back to the start? The answers in this round won’t be kept.',
      )
    ) {
      return;
    }
    // Leaving the dashboard or guide: drop their hash so a reload lands on the start screen too.
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    setScreen({ name: 'start' });
  };

  // Report each answer to the class. The server grades it; we only send the choice.
  const sendAnswer = useCallback(
    async (answer: Answer) => {
      if (!session) return;
      const attemptId = attemptIdRef.current;
      if (!attemptId) return; // this round couldn't reach the class; already explained
      const body = {
        playerId: session.playerId,
        attemptId,
        messageId: answer.message.id,
        choice: answer.guessedPhish ? ('phish' as const) : ('legit' as const),
      };
      setPendingSends((n) => n + 1);
      try {
        // Three quick tries (waiting 1 s, then 2 s, between them). After that the answer is
        // queued and re-sent later instead of being dropped.
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
          if ((await trySend(session.code, body)) === 'done') return;
        }
        queuedRef.current.set(`${attemptId}:${body.messageId}`, { code: session.code, body });
        setSyncError(QUEUED_MESSAGE);
      } finally {
        setPendingSends((n) => n - 1);
      }
    },
    [session, trySend],
  );
  const reportAnswer = useCallback(
    (answer: Answer) => {
      const sending = sendAnswer(answer);
      inFlightRef.current.add(sending);
      void sending.finally(() => inFlightRef.current.delete(sending));
      return sending;
    },
    [sendAnswer],
  );

  const inGame = screen.name === 'start' || screen.name === 'play' || screen.name === 'results';
  const message = syncError ?? notice;

  const startProps: StartScreenProps = {
    session,
    onStart: play,
    onQuickStart: session ? undefined : playQuick,
    onJoinClass: () => setScreen({ name: 'join' }),
    onLeaveClass: () => {
      if (!session) return;
      // Leaving forgets the player too, so the next person on a shared browser isn't offered
      // "Continue as" this student. That makes the rejoin code the only way back, so ask first.
      const codeNote = rejoinCode ? ` Your rejoin code is ${rejoinCode}.` : '';
      const leave = window.confirm(
        `Leave class ${session.code}? To come back as ${session.nickname}, you’ll need your rejoin code.${codeNote}`,
      );
      if (!leave) return;
      forgetPlayer(session.code);
      setSession(null);
      setNotice(null);
      setRejoinCode(null);
    },
    rejoinCode,
    onDismissRejoinCode: () => setRejoinCode(null),
    onOpenDashboard: (credentials) => {
      window.location.hash = dashboardHash(credentials);
    },
    onTeacher: () => setScreen({ name: 'teacher' }),
    // Only used while the start screen is showing, so "back" is the start screen.
    onTeacherGuide: openGuide,
    onPasswordCheck: () => openPasswordCheck({ name: 'start' }),
  };
  const playProps =
    screen.name === 'play'
      ? {
          deck: screen.deck,
          initialAnswers: screen.initialAnswers,
          onAnswer: session && !screen.quick ? reportAnswer : undefined,
          onFinish: (answers: Answer[]) => setScreen({ name: 'results', answers, quick: screen.quick }),
        }
      : null;

  return (
    <div className={`mx-auto w-full px-4 pb-16 sm:px-6 ${SCREEN_WIDTHS[screen.name]}`}>
      {screen.name === 'start' ? (
        <div className="pt-6 sm:pt-10" />
      ) : (
        <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
          <h1>
            <button type="button" onClick={goToStart} aria-label="Hooked, go to start" className="hk-focus rounded-chip">
              <Wordmark size="sm" />
            </button>
          </h1>
          {session && (screen.name === 'play' || screen.name === 'results') && (
            <p className="rounded-full bg-raised px-3 py-1 text-small text-ink">
              Class <span className="font-code font-bold">{session.code}</span> · {session.nickname}
            </p>
          )}
        </header>
      )}
      <div role="status">
        {message && inGame && (
          <div className="mb-6">
            <Notice tone={syncError ? 'error' : 'info'}>{message}</Notice>
          </div>
        )}
      </div>
      <main ref={mainRef}>
        {screen.name === 'start' && <StartScreen {...startProps} />}
        {playProps && <PlayScreen key={round} {...playProps} />}
        {screen.name === 'results' && (
          <ResultsScreen
            answers={screen.answers}
            quick={screen.quick}
            totalMessages={messages.length}
            // Only claim the answers reached the class when nothing went wrong this round
            // (every failure path sets syncError or ends the session).
            classCode={screen.quick || syncError ? undefined : session?.code}
            classSaving={pendingSends > 0}
            onPlayAgain={play}
            onPasswordCheck={() => openPasswordCheck(screen)}
          />
        )}
        {screen.name === 'password' && <PasswordScreen onBack={() => setScreen(screen.back)} />}
        {screen.name === 'join' && (
          <JoinScreen
            initialCode={screen.initialCode}
            onBack={() => setScreen({ name: 'start' })}
            onJoined={(joined, newRejoinCode) => {
              rememberPlayer(joined);
              setSession(joined);
              setNotice(null);
              setRejoinCode(newRejoinCode ?? null);
              setScreen({ name: 'start' });
            }}
          />
        )}
        {screen.name === 'teacher' && (
          <TeacherScreen
            onBack={() => setScreen({ name: 'start' })}
            onTeacherGuide={openGuide}
            onCreated={(credentials) => rememberClass({ ...credentials, createdAt: new Date().toISOString() })}
            onOpenDashboard={(credentials) => {
              window.location.hash = dashboardHash(credentials);
            }}
          />
        )}
        {screen.name === 'guide' && (
          <TeacherGuideScreen
            onBack={() => {
              // Opened in the app: step back through history, which the hashchange handler
              // follows. Opened from a link: there's no earlier entry here, so just clear the hash.
              if (guidePushedRef.current && window.location.hash === TEACHER_GUIDE_HASH) {
                guidePushedRef.current = false;
                window.history.back();
                return;
              }
              if (window.location.hash === TEACHER_GUIDE_HASH) window.history.replaceState(null, '', window.location.pathname);
              setScreen(screen.back);
            }}
          />
        )}
        {screen.name === 'dashboard' && (
          <DashboardScreen
            key={screen.credentials.code}
            credentials={screen.credentials}
            onGone={() => forgetClass(screen.credentials.code)}
          />
        )}
      </main>
    </div>
  );
}
