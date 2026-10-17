import { useCallback, useEffect, useState } from 'react';
import { messages, type Message } from '../../shared/messages.ts';
import { api, ApiRequestError } from './class/api.ts';
import { dashboardHash, readDashboardHash, type TeacherCredentials } from './class/dashboardLink.ts';
import type { Answer } from './game/types.ts';
import { DashboardScreen } from './screens/DashboardScreen.tsx';
import { JoinScreen, type ClassSession } from './screens/JoinScreen.tsx';
import { PasswordScreen } from './screens/PasswordScreen.tsx';
import { PlayScreen } from './screens/PlayScreen.tsx';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { StartScreen } from './screens/StartScreen.tsx';
import { TeacherScreen } from './screens/TeacherScreen.tsx';

type GameScreen =
  | { name: 'start' }
  | { name: 'play'; deck: Message[] }
  | { name: 'results'; answers: Answer[] };

type Screen =
  | GameScreen
  | { name: 'password'; back: GameScreen }
  | { name: 'join' }
  | { name: 'teacher' }
  | { name: 'dashboard'; credentials: TeacherCredentials };

function initialScreen(): Screen {
  const credentials = readDashboardHash();
  if (credentials) return { name: 'dashboard', credentials };

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

  // A dashboard link pasted into an already-open tab only changes the hash.
  useEffect(() => {
    const onHashChange = () => {
      const credentials = readDashboardHash();
      if (credentials) setScreen({ name: 'dashboard', credentials });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const play = () => {
    setRound((r) => r + 1);
    setSyncError(null);
    setScreen({ name: 'play', deck: messages });
  };
  const openPasswordCheck = (back: GameScreen) => setScreen({ name: 'password', back });

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
          // 4xx won't get better on retry (e.g. the teacher removed this player).
          if (err instanceof ApiRequestError && err.status !== null && err.status < 500) {
            setSyncError(err.message);
            return;
          }
          await sleep(1000 * 2 ** attempt);
        }
      }
      setSyncError('Couldn’t send an answer to your class. Check your connection.');
    },
    [session],
  );

  const showHeader = screen.name !== 'start';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      {showHeader && (
        <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-lg font-bold tracking-tight">Hooked</h1>
          {session && (screen.name === 'play' || screen.name === 'results') && (
            <p className="text-sm text-slate-600">
              Class <span className="font-mono font-semibold">{session.code}</span> · {session.nickname}
            </p>
          )}
        </header>
      )}
      {syncError && (screen.name === 'play' || screen.name === 'results') && (
        <p role="status" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          {syncError}
        </p>
      )}
      <main>
        {screen.name === 'start' && (
          <StartScreen
            session={session}
            onStart={play}
            onJoinClass={() => setScreen({ name: 'join' })}
            onLeaveClass={() => setSession(null)}
            onTeacher={() => setScreen({ name: 'teacher' })}
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
            onBack={() => setScreen({ name: 'start' })}
            onJoined={(joined) => {
              setSession(joined);
              setScreen({ name: 'start' });
            }}
          />
        )}
        {screen.name === 'teacher' && (
          <TeacherScreen
            onBack={() => setScreen({ name: 'start' })}
            onOpenDashboard={(credentials) => {
              window.location.hash = dashboardHash(credentials);
            }}
          />
        )}
        {screen.name === 'dashboard' && <DashboardScreen key={screen.credentials.code} credentials={screen.credentials} />}
      </main>
    </div>
  );
}
