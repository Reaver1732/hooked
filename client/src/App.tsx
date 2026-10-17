import { useState } from 'react';
import { messages } from './data/messages.ts';
import { shuffle } from './game/shuffle.ts';
import type { Answer } from './game/types.ts';
import { PlayScreen } from './screens/PlayScreen.tsx';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { StartScreen } from './screens/StartScreen.tsx';

type Screen =
  | { name: 'start' }
  | { name: 'play'; deck: typeof messages; round: number }
  | { name: 'results'; answers: Answer[]; round: number };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'start' });
  const round = screen.name === 'start' ? 0 : screen.round;
  const play = () => setScreen({ name: 'play', deck: shuffle(messages), round: round + 1 });

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
