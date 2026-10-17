import { useCallback, useEffect, useRef, useState } from 'react';
import { messages, type Message } from '../../shared/messages.ts';
import { api, ApiRequestError } from './class/api.ts';
import { dashboardHash, readDashboardHash, type TeacherCredentials } from './class/dashboardLink.ts';
import { takeJoinParam } from './class/joinLink.ts';
import type { Answer } from './game/types.ts';
import { Logo } from './components/Logo.tsx';
import { DashboardScreen } from './screens/DashboardScreen.tsx';
import { JoinScreen, type ClassSession } from './screens/JoinScreen.tsx';
import { PasswordScreen } from './screens/PasswordScreen.tsx';
import { PlayScreen } from './screens/PlayScreen.tsx';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { StartScreen } from './screens/StartScreen.tsx';
import { TEACHER_GUIDE_HASH, TeacherGuideScreen } from './screens/TeacherGuideScreen.tsx';
import { TeacherScreen } from './screens/TeacherScreen.tsx';

type GameScreen =
  | { name: 'start' }
  | { name: 'play'; deck: Message[] }
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [round, setRound] = useState(0);
  const [session, setSession] = useState<ClassSession | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
  const closeSession = useCallback(() => {
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
        if (err instanceof ApiRequestError && err.status === 404) closeSession();
        else setSyncError(removedMessage);
      }
    },
    [closeSession],
  );

  const play = async () => {
    if (session) {
      try {
        await api.classStatus(session.code);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) {
          closeSession();
          return;
        }
        // Offline or a server hiccup: play anyway; answers retry and report problems.
      }
    }
    setRound((r) => r + 1);
    setSyncError(null);
    setNotice(null);
    setScreen({ name: 'play', deck: messages });
  };
  const openPasswordCheck = (back: GameScreen) => setScreen({ name: 'password', back });
  const openGuide = (back: Screen) => setScreen({ name: 'guide', back });

  // Report each answer to the class. The server grades it; we only send the choice.
  const reportAnswer = useCallback(
    async (answer: Answer) => {
      if (!session) return;
      const body = {
        playerId: session.playerId,
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

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:py-8">
      {screen.name !== 'start' && (
        <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1>
            <Logo />
          </h1>
          {session && (screen.name === 'play' || screen.name === 'results') && (
            <p className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 ring-1 ring-slate-200">
              Class <span className="font-mono font-semibold text-slate-900">{session.code}</span> · {session.nickname}
            </p>
          )}
        </header>
      )}
      <div role="status">
        {message && inGame && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{message}</p>
        )}
      </div>
      <main ref={mainRef}>
        {screen.name === 'start' && (
          <StartScreen
            session={session}
            onStart={play}
            onJoinClass={() => setScreen({ name: 'join' })}
            onLeaveClass={() => {
              setSession(null);
              setNotice(null);
            }}
            onTeacher={() => setScreen({ name: 'teacher' })}
            onTeacherGuide={() => openGuide(screen)}
            onPasswordCheck={() => openPasswordCheck(screen)}
          />
        )}
        {screen.name === 'play' && (
          <PlayScreen
            key={round}
            deck={screen.deck}
            onAnswer={session ? reportAnswer : undefined}
            onFinish={(answers) => setScreen({ name: 'results', answers })}
          />
        )}
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
            onJoined={(joined) => {
              setSession(joined);
              setNotice(null);
              setScreen({ name: 'start' });
            }}
          />
        )}
        {screen.name === 'teacher' && (
          <TeacherScreen
            onBack={() => setScreen({ name: 'start' })}
            onTeacherGuide={() => openGuide(screen)}
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
        {screen.name === 'dashboard' && <DashboardScreen key={screen.credentials.code} credentials={screen.credentials} />}
      </main>
    </div>
  );
}
