# Hooked

**Spot the phish before it hooks you.** A phishing-awareness game for grades 6 to 12: students sort real-looking emails, texts, and DMs into phish or legit, then see exactly which red flags they missed. Teachers can run it with a whole class from a QR code and review the results together.

- Live: https://hooked-production-f0a4.up.railway.app
- Quick round (5 messages): https://hooked-production-f0a4.up.railway.app/?quick=1
- Custom Domain: https://www.dontgethooked.study
- Demo video: https://youtu.be/CLO7XndXVRM

![The reveal after answering, at desktop width: a fake "package on hold" text with three numbered highlights (a $1.99 fee, a 24-hour deadline, and a lookalike link), the "Correct! Nice catch." verdict, and a Red flags list explaining each numbered highlight.](docs/reveal-1280.png)

## The problem

Students get scam messages everywhere they are online: fake login alerts for their game accounts, "your package is on hold" texts, friends' hacked accounts sending links, strangers asking for the code that was just texted to them. Most safety lessons describe phishing in the abstract, but the skill that matters is noticing the small details in a message that looks real, quickly, on a phone or a Chromebook.

## The solution

Hooked turns that skill into a short game. Each round shows a message styled like the app it would arrive in. The student decides **Phish** or **Legit**, and the message then lights up with numbered highlights explaining each red flag (or each sign it's safe). At the end they see their score and which kinds of red flags they miss most.

In a classroom, the teacher creates a class, projects a QR code, and watches a live dashboard of what the class finds hardest, ready to discuss in the last five minutes of the period.

## Features

- **Realistic messages** shown as a mail client, a phone's text app, or a chat app's DMs, with an optional "Situation" line for context.
- **Explained answers:** each red flag or safe sign is highlighted in the message and explained, including links (hover or focus a link to see where it really goes; links never open).
- **Results** with "most-missed red flags" and false alarms.
- **Class mode:** join by QR code or 6-character code with just a nickname. Students can replay. A teacher dashboard refreshes every 5 seconds with each student's first score (played before they'd seen any answers) next to their best score, their attempts, and Passed / Not yet (the best score against a passing score the teacher sets, default 80%). It also shows the class's most-missed red flags and per-message results, taken from each student's first run so replays don't hide what fooled the class. Teachers can show the QR code again, export a CSV, remove nicknames, reset a student's rejoin code, get a new dashboard link if the old one leaks (the old one stops working, results stay), and delete the class.
- **Pick up where you left off, without accounts:** this browser remembers which player you are in each class (and, for teachers, the classes created here), so students resume at the first message they haven't answered, and a refresh keeps the tab in its class. On another device, a 6-character rejoin code shown once at joining restores the player.
- **Password check:** see whether a password has appeared in a data breach without sending it anywhere, plus a random 5-word passphrase suggestion.
- **Guide for teachers** in the app: a 15 to 20 minute lesson plan, what's stored, and discussion questions.
- **Accessible:** keyboard shortcuts (P, L, Enter; the letter keys can be turned off for speech input), full keyboard and screen-reader support, WCAG AA contrast, reduced-motion support, and layouts that work down to 375px wide. Checked with axe-core in scripted browser runs during development (those scripts aren't in this repo yet).

## How it works

```mermaid
flowchart LR
  B["Browser<br/>React client"] -- "/api (JSON)" --> S["Express server<br/>(one Railway service)"]
  S -- "Prisma" --> D[("Postgres<br/>on Railway")]
  B -- "first 5 hex chars of a SHA-1" --> H["Have I Been Pwned<br/>Pwned Passwords API"]
  S -- "serves the built client" --> B
```

- **Client:** React 19, Vite, TypeScript and Tailwind CSS v4. All game state lives in React; solo play needs no server calls. Every color, font size, radius and shadow comes from one set of design tokens (`client/src/design`). Messages live in `shared/messages.ts`, and `npm run check:messages` verifies every highlight matches its message text exactly once.
- **Server:** Express 5 in TypeScript. It serves the built client and a small JSON API for classes. It grades answers itself from the same shared message data, so the client never reports whether it was right. All input is validated with zod, and request bodies are strict: a nickname, a rejoin code, an answer, or the teacher's passing score, and nothing else. Class creation, joins, failed rejoins (10 wrong codes per student and 120 per network every 10 minutes), player lookups (per player), answers, and class status checks are rate limited, with budgets sized so a classroom sharing one network stays under them in normal use. Teacher routes need the teacher key; dashboard refreshes are capped per class and repeated wrong keys per network. Changes through the API must come from the site's own pages, so another website can't make a visitor's browser create classes or join them.
- **Database:** Postgres through Prisma 7 with four tables: `Class`, `Player`, `Attempt`, `Answer`. Each play-through is an attempt; only the first answer to each message within an attempt counts. Passed uses a student's best finished attempt; their first finished attempt is shown next to it and feeds the class's most-missed red flags and per-message results. The 60-player cap is enforced in a single SQL statement, so a whole class can join at once. An hourly job deletes classes that haven't been used for 7 days.
- **Hosting:** one Railway service plus Railway Postgres. Railway runs `npm run build`, then the pre-deploy command `npm run db:migrate` (a failed migration leaves the previous version running), then `npm start`, with a health check on `/api/health`. It always answers 200 so solo play never depends on the database; its `db` field (`ok`, `down`, `unconfigured`, or `checking` just after start, refreshed at most every 30 seconds) says whether class mode can reach Postgres.

## The password check, step by step

The check uses the Pwned Passwords **range API**, which is built on *k-anonymity*: the service only ever learns a 5-character prefix, which about 2,000 known breached passwords (and countless others) share.

1. The student types a password. It stays in the page's memory and is cleared when they leave the screen. It is never stored or logged.
2. When they press **Check**, the browser computes the password's SHA-1 hash with the built-in Web Crypto API, giving 40 hexadecimal characters.
3. Only the **first 5 characters** are sent: `GET https://api.pwnedpasswords.com/range/{prefix}`, with the header `Add-Padding: true`.
4. The API replies with every known breached-password hash that starts with that prefix (about 2,000 suffixes when we tested), each with a count of how many times it appeared in breaches. Because of the padding header, it also adds fake rows with a count of 0, so the size of the response doesn't hint at the prefix.
5. The browser ignores the padding rows and compares the remaining **35 characters** of the hash against the list, locally.
6. If there's a match, the student sees how many times the password appeared in breaches; if not, they're told that not being found doesn't make a password strong. A **What left this device** panel shows the 5 characters that were sent next to the full hash.
7. Hooked suggests a passphrase: 5 words picked with `crypto.getRandomValues` from the EFF Short Wordlist, after removing 73 words about drugs, alcohol, gambling, sex, violence, death, body parts, religion, and politics, plus hateful words and insults (1,223 words left, so about 51 bits of randomness).

## Privacy

- **What Hooked stores:** for each student in a class, the nickname they type, when they joined, a hash of their rejoin code, and their answers grouped into attempts (which message, phish or legit, whether it was right, when it was given, and when each attempt started and finished). For each class, a 6-character code, the passing score, when the class was created and last used, and a SHA-256 hash of the teacher's dashboard key; the keys and codes themselves are only ever shown to the teacher or student they belong to.
- **On the device:** the browser's local storage remembers, for teachers, the classes created there (code and dashboard key, so the dashboard can be reopened from the start screen) and, for students, their player in each class (class code, player id, nickname). Nothing else, and never passwords or answers. On a shared computer, anyone using that browser can reopen those dashboards, so teachers should press **Forget** next to the class on the start screen (the class and its results stay), delete the class when done, or use a private window.
- **Nothing else:** no accounts, real names, email addresses, cookies, or analytics. Solo play doesn't send answers anywhere.
- **Deletion:** a class, with its players and answers, is deleted when the teacher deletes it, or automatically after 7 days with no use (no joins, no answers, no dashboard visits). The dashboard shows the date.
- **Passwords** are never stored or sent. Only a 5-character prefix of the password's SHA-1 hash leaves the device (see above). The student's browser contacts Have I Been Pwned (served through Cloudflare) directly, and only when they press Check, so that service sees the device's IP address, as any website does. Hooked's server isn't involved.
- **Logs:** Hooked's own logs don't record IP addresses or player ids, and its database never saves IP addresses. To slow down abuse, the server keeps short-lived request counts in memory, per IP address and for some limits per class, per player, or per class code and nickname; they're never written to disk and are gone within about two hours. Like any website, the hosting provider (Railway) keeps standard request logs that include IP addresses.

## Run it locally

Requirements: Node.js 22 or newer and npm. A Postgres database is only needed for class mode.

```sh
npm install
npm run dev        # client on http://localhost:5173, API on :3001 (proxied)
```

For class mode, put a connection string in a `.env` file at the repo root (it's gitignored), then apply the migrations:

```sh
DATABASE_URL=postgresql://user:password@host:5432/db
```

```sh
npm run db:migrate
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Checks the messages, then builds the client and server |
| `npm start` | Serves the built app on `$PORT` |
| `npm run check:messages` | Validates every message's highlights and links |
| `npm run smoke -- <url>` | End-to-end check of a deployed site (health, class, join, answer, dashboard, delete); cleans up after itself |
| `npm run db:migrate:dev -w server -- --name <change>` | Creates a migration after editing `server/prisma/schema.prisma` |

In dev, `?msg=<id>` opens a single message directly.

To deploy on Railway, create a service from the repo plus a Postgres database, then set the service's `DATABASE_URL` variable to `${{Postgres.DATABASE_URL}}`, its pre-deploy command to `npm run db:migrate`, and its health check path to `/api/health`.

## Credits

- Passphrase words from the [EFF Short Wordlist](https://www.eff.org/dice) (CC BY 3.0), with 73 words removed for school use (listed in `client/src/password/passphrase.ts`).
- Fonts: [Fredoka](https://fonts.google.com/specimen/Fredoka) and [Nunito](https://fonts.google.com/specimen/Nunito) (SIL Open Font License), self-hosted through [Fontsource](https://fontsource.org).
- Breach data from the [Have I Been Pwned](https://haveibeenpwned.com/Passwords) Pwned Passwords API by Troy Hunt. HIBP's API documentation states that the Pwned Passwords API has no licensing or attribution requirements; we credit it here and in the app anyway.
- All people, companies, and schools in the game are made up. Links in the game never open.

## AI disclosure

Built with Claude and Claude Code (Anthropic) as AI assistants. Breach data from the Have I Been Pwned Pwned Passwords API.
