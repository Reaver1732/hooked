import compression from 'compression';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { apiErrorHandler, classesRouter } from './classes.ts';
import { loadLocalEnv } from './env.ts';

loadLocalEnv();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(compression());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.use('/api', express.json({ limit: '2kb' }), classesRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use('/api', apiErrorHandler);

// In production the built client lives in client/dist; in dev Vite serves it instead.
// Compiled output sits deeper (dist/server/src) than the source, so search upward.
const clientDist = findUp(import.meta.dirname, path.join('client', 'dist'));
if (clientDist) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

function findUp(start: string, relative: string): string | null {
  for (let dir = start; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, relative);
    if (fs.existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}
