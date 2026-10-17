# Hooked

A phishing-spotting game: sort real-looking emails, texts and DMs into phish or legit, then see the red flags. Includes a password breach check that sends only a 5-character hash prefix to Have I Been Pwned.

## Scripts

```sh
npm install
npm run dev             # Vite on :5173, Express on :3001 (/api is proxied)
npm run build           # check:messages, then build client and server
npm start               # serve the built app on $PORT
npm run check:messages  # validate highlights and link tokens in client/src/data/messages.ts
```

In dev, `?msg=<id>` opens a single message directly.

## Credits

Passphrase words from the EFF Long Wordlist (CC BY 3.0).
