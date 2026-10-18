import { useCallback, useEffect, useRef, useState } from 'react';
import { messages, type Message } from '../../shared/messages.ts';
import { api, ApiRequestError } from './class/api.ts';
import { dashboardHash, readDashboardHash, type TeacherCredentials } from './class/dashboardLink.ts';
import { takeJoinParam } from './class/joinLink.ts';
import { forgetClass, forgetPlayer, rememberClass, rememberPlayer } from './class/storage.ts';
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
  | { name: 'play'; deck: Message[]; initialAnswers?: Answer[] }
  | { name: 'results'; answers: Answer[] };

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
  const [session, setSession] = useState<ClassSession | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** A new player's rejoin code, shown once on the start screen. */
  const [rejoinCode, setRejoinCode] = useState<string | null>(null);
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

  // A dashboard link pasted into an already-open tab only changes the hash.
  useEffect(() => {
    const onHashChange = () => {
      const credentials = readDashboardHash();
      if (credentials) setScreen({ name: 'dashboard', credentials });
      else if (window.location.hash === TEACHER_GUIDE_HASH) setScreen((s) => (s.name === 'guide' ? s : { name: 'guide', back: s }));
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

  /** After a 404 for this player: tell "class closed" apart from "you were removed". */
  const explainMissingPlayer = useCallback(
    async (code: string, removedMessage: string) => {
      try {
        await api.classStatus(code);
        setSyncError(removedMessage);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) closeSession(code);
        else setSyncError(removedMessage);
      }
    },
    [closeSession],
  );

  const play = async () => {
    let initialAnswers: Answer[] = [];
    attemptIdRef.current = null;
    setSyncError(null);
    setNotice(null);
    if (session) {
      try {
        // Resumes the unfinished attempt (if any) or starts a new one.
        const attempt = await api.startAttempt(session.playerId);
        attemptIdRef.current = attempt.attemptId;
        initialAnswers = resumedAnswers(attempt.answers);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) {
          await explainMissingPlayer(session.code, 'You’re no longer in this class. Join again, or keep playing on your own.');
          forgetPlayer(session.code);
          setSession(null);
          return;
        }
        setSyncError('Couldn’t reach your class, so this round won’t count for it. Check your connection.');
      }
    }
    setRound((r) => r + 1);
    if (initialAnswers.length >= messages.length) setScreen({ name: 'results', answers: initialAnswers });
    else setScreen({ name: 'play', deck: messages, initialAnswers });
  };
  const openPasswordCheck = (back: GameScreen) => setScreen({ name: 'password', back });
  const openGuide = (back: Screen) => setScreen({ name: 'guide', back });

  // Report each answer to the class. The server grades it; we only send the choice.
  const reportAnswer = useCallback(
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
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await api.submitAnswer(body);
          return;
        } catch (err) {
          if (err instanceof ApiRequestError && err.status === 404) {
            await explainMissingPlayer(session.code, err.message);
            return;
          }
          // Other 4xx won't get better on retry.
          if (err instanceof ApiRequestError && err.status !== null && err.status < 500) {
            setSyncError(err.message);
            return;
          }
          await sleep(1000 * 2 ** attempt);
        }
      }
      setSyncError('Couldn’t send an answer to your class. Check your connection.');
    },
    [session, explainMissingPlayer],
  );

  const inGame = screen.name === 'start' || screen.name === 'play' || screen.name === 'results';
  const message = syncError ?? notice;

  const startProps: StartScreenProps = {
    session,
    onStart: play,
    onJoinClass: () => setScreen({ name: 'join' }),
    onLeaveClass: () => {
      // Forget the player too, so the next person on a shared browser isn't offered
      // "Continue as" this student. Coming back on this device needs the rejoin code.
      if (session) forgetPlayer(session.code);
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
    onTeacherGuide: () => openGuide({ name: 'start' }),
    onPasswordCheck: () => openPasswordCheck({ name: 'start' }),
  };
  const playProps =
    screen.name === 'play'
      ? {
          deck: screen.deck,
          initialAnswers: screen.initialAnswers,
          onAnswer: session ? reportAnswer : undefined,
          onFinish: (answers: Answer[]) => setScreen({ name: 'results', answers }),
        }
      : null;

  return (
    <div className={`mx-auto w-full px-4 pb-16 sm:px-6 ${SCREEN_WIDTHS[screen.name]}`}>
      {screen.name === 'start' ? (
        <div className="pt-6 sm:pt-10" />
      ) : (
        <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
          <h1>
            <Wordmark size="sm" />
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
            classCode={session?.code}
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
            onTeacherGuide={() => openGuide(screen)}
            onCreated={(credentials) => rememberClass({ ...credentials, createdAt: new Date().toISOString() })}
            onOpenDashboard={(credentials) => {
              window.location.hash = dashboardHash(credentials);
            }}
          />
        )}
        {screen.name === 'guide' && (
          <TeacherGuideScreen
            onBack={() => {
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
