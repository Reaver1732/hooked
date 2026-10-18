import compression from 'compression';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { apiErrorHandler, classesRouter } from './classes.ts';
import { startClassCleanup } from './cleanup.ts';
import { loadLocalEnv } from './env.ts';

loadLocalEnv();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// On Railway, two proxies sit in front of the app. Observed in production: the edge
// replaces any client-sent X-Forwarded-For with the client's address, and an internal
// hop then appends the edge's own (152.233.40.x), so the app receives
// "X-Forwarded-For: <client>, <edge>". Trusting exactly 2 hops makes req.ip the client;
// trusting 1 would make every client look like the edge and share one rate limit.
// Locally nothing is trusted. RAILWAY_ENVIRONMENT_ID is injected by Railway at runtime.
app.set('trust proxy', process.env.RAILWAY_ENVIRONMENT_ID ? 2 : false);
app.disable('x-powered-by');

// Security headers on every response. The CSP allows only this site's own scripts,
// styles and fonts, data: images (the QR code), and the Pwned Passwords API.
// React sets inline styles through the DOM, which CSP allows without 'unsafe-inline'.
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://api.pwnedpasswords.com",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
};
app.use((_req, res, next) => {
  res.set(SECURITY_HEADERS);
  next();
});

app.use(compression());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
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
  startClassCleanup();
});

function findUp(start: string, relative: string): string | null {
  for (let dir = start; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, relative);
    if (fs.existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}
