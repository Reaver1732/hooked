# Hooked

A phishing-spotting game: sort real-looking emails, texts and DMs into phish or legit, then see the red flags. Includes a password breach check that sends only a 5-character hash prefix to Have I Been Pwned, and optional class codes with a teacher dashboard.

## Scripts

```sh
npm install
npm run dev             # Vite on :5173, Express on :3001 (/api is proxied)
npm run build           # check:messages, then build client and server
npm start               # serve the built app on $PORT
npm run check:messages  # validate highlights and link tokens in shared/messages.ts
npm run db:migrate      # apply pending migrations (prisma migrate deploy)
```

In dev, `?msg=<id>` opens a single message directly.

## Layout

- `client/`: React + Vite app
- `server/`: Express API and static file server; Prisma schema and migrations in `server/prisma/`
- `shared/`: message data, flag labels and API types used by both (the server grades answers from this data)

## Classes and the database

Solo play needs no database. Class codes and the teacher dashboard need Postgres via `DATABASE_URL`; without it the server still runs and the class endpoints return 503.

For local development, put the URL in a `.env` at the repo root (gitignored):

```sh
DATABASE_URL=postgresql://...
```

To change the schema, edit `server/prisma/schema.prisma` and run `npm run db:migrate:dev -w server -- --name <change>`.

Students can join with the code or by opening `<site>/?join=CODE` (the teacher screen shows it as a QR code), which fills in the code for them.

Limits, designed so a classroom or venue sharing one IP is never blocked (rate limits are in memory, per server instance):

- Class creation: 10 per hour per IP
- Joins: 300 per 10 minutes per IP, and at most 60 players per class
- Answers: 60 per minute per player (unknown player ids are rejected before counting)

Rate-limit hits are logged by limit name only; no IPs or player ids are logged.

### Railway

The `hooked` service is configured in the Railway dashboard (no config file):

- Variable `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
- Pre-deploy command: `npm run db:migrate` (a failed migration leaves the previous deploy running)
- Healthcheck path: `/api/health`

## Credits

Passphrase words from the EFF Long Wordlist (CC BY 3.0).
