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

// Changes through the API must come from this site's own pages. Otherwise any website could
// make its visitors' browsers create classes (a body-less POST needs no CORS preflight) and
// use up a school network's class budget. Browsers label requests with Sec-Fetch-Site; older
// Safari sends only Origin, which is compared with the host instead. A request with neither
// isn't from a web page (curl, scripts, the smoke test) and passes.
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const hostOf = (origin: string) => {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
};
app.use('/api', (req, res, next) => {
  if (READ_METHODS.has(req.method)) return next();
  const site = req.get('sec-fetch-site');
  const origin = req.get('origin');
  const allowed = site
    ? site === 'same-origin' || site === 'none'
    : !origin || [req.get('host'), req.get('x-forwarded-host')].includes(hostOf(origin) ?? '');
  if (allowed) return next();
  res.status(403).json({ error: 'Requests from other websites aren’t allowed.' });
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
  // Vite puts a content hash in every /assets file name, so those files never change and can be
  // cached for a year. index.html is checked on every visit, so a deploy is picked up at once.
  const assetsDir = path.join(clientDist, 'assets') + path.sep;
  const NO_CACHE = { 'Cache-Control': 'no-cache' };
  app.use(
    express.static(clientDist, {
      setHeaders: (res, filePath) => {
        if (filePath.startsWith(assetsDir)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        else if (path.basename(filePath) === 'index.html') res.set(NO_CACHE);
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    // A missing file (an old hashed asset, a renamed wordlist) is a 404, not the app's HTML,
    // which would otherwise be parsed as the file. App routes never contain a dot.
    if (req.path.startsWith('/assets/') || path.extname(req.path)) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    res.sendFile(path.join(clientDist, 'index.html'), { headers: NO_CACHE });
  });
}

app.listen(PORT, (err) => {
  // Express 5 hands listen errors (port in use, no permission) to this callback instead of
  // throwing; without this check a clash logged "listening" and exited with status 0.
  if (err) {
    console.error(`Server couldn’t listen on port ${PORT}: ${err.message}`);
    process.exitCode = 1;
    return;
  }
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
