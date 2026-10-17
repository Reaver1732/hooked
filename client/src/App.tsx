import { useEffect, useState } from 'react';
import { MessageBody } from './components/MessageBody.tsx';
import { messages } from './data/messages.ts';

type Health = 'checking' | 'ok' | 'down';

export default function App() {
  const [health, setHealth] = useState<Health>('checking');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => setHealth(res.ok ? 'ok' : 'down'))
      .catch(() => setHealth('down'));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6 text-slate-800">
      <h1 className="text-4xl font-bold tracking-tight">Hooked</h1>
      <p className="text-slate-600">Spot the phish. Game screens coming soon.</p>
      <p className="text-sm">
        API:{' '}
        <span className={health === 'ok' ? 'text-green-600' : health === 'down' ? 'text-red-600' : 'text-slate-500'}>
          {health}
        </span>
        {' · '}
        {messages.length} messages loaded
      </p>
      <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Body preview (hover or tab to the link)</p>
        <MessageBody message={messages[0]} />
      </div>
    </main>
  );
}
