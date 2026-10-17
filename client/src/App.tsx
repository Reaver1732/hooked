import { useState } from 'react';
import { messages, type Message } from './data/messages.ts';
import type { Answer } from './game/types.ts';
import { PlayScreen } from './screens/PlayScreen.tsx';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { StartScreen } from './screens/StartScreen.tsx';

type Screen =
  | { name: 'start' }
  | { name: 'play'; deck: Message[]; round: number }
  | { name: 'results'; answers: Answer[]; round: number };

function initialScreen(): Screen {
  // Dev-only preview: ?msg=<id> opens that message directly. import.meta.env.DEV is
  // replaced with `false` in production builds, so this whole branch is dropped.
  if (import.meta.env.DEV) {
    const id = new URLSearchParams(window.location.search).get('msg');
    if (id) {
      const message = messages.find((m) => m.id === id);
      if (message) return { name: 'play', deck: [message], round: 1 };
      console.warn(`?msg=${id} matches no message. Known ids: ${messages.map((m) => m.id).join(', ')}`);
    }
  }
  return { name: 'start' };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const round = screen.name === 'start' ? 0 : screen.round;
  const play = () => setScreen({ name: 'play', deck: messages, round: round + 1 });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      {screen.name !== 'start' && (
        <header className="mb-6">
          <h1 className="text-lg font-bold tracking-tight">Hooked</h1>
        </header>
      )}
      <main>
        {screen.name === 'start' && <StartScreen onStart={play} />}
        {screen.name === 'play' && (
          <PlayScreen
            key={screen.round}
            deck={screen.deck}
            onFinish={(answers) => setScreen({ name: 'results', answers, round: screen.round })}
          />
        )}
        {screen.name === 'results' && <ResultsScreen answers={screen.answers} onPlayAgain={play} />}
      </main>
    </div>
  );
}
