export type FlagType =
  | 'lookalike-sender'
  | 'urgency'
  | 'mismatched-link'
  | 'asks-for-credentials'
  | 'generic-greeting'
  | 'too-good-to-be-true'
  | 'unexpected-attachment';

// `match` must be an exact substring of the message, found exactly once across
// from.name, from.address, subject and the rendered body (link tokens replaced by
// link text). Run `npm run check:messages`.
export type Highlight = { match: string; type?: FlagType; note: string };

// Rendered as a <FakeLink>, never a real <a>. Placed inline where the body has
// {{i}} (its index in `links`); every link must be referenced exactly where it shows.
export type FakeLink = { text: string; realUrl: string };

export type Message = {
  id: string;
  kind: 'email' | 'text';
  from: { name: string; address: string };
  subject?: string;
  body: string;
  links: FakeLink[];
  isPhish: boolean;
  highlights: Highlight[]; // red flags for phish, safe signs for legit
};

export const messages: Message[] = [
  {
    id: 'bank-signin-phish',
    kind: 'email',
    from: { name: 'Northwind Bank', address: 'alerts@northwlnd-secure.com' },
    subject: 'Unusual sign-in detected on your account',
    body: [
      'Dear Customer,',
      'We detected an unusual sign-in attempt and have temporarily limited access to your Northwind Bank account.',
      'To restore access, visit {{0}} and confirm your password and card details within 24 hours or your account will be permanently closed.',
      'Northwind Security Team',
    ].join('\n\n'),
    links: [{ text: 'northwindbank.com/restore', realUrl: 'http://northwlnd-secure.com/login.php?id=88213' }],
    isPhish: true,
    highlights: [
      {
        match: 'alerts@northwlnd-secure.com',
        type: 'lookalike-sender',
        note: '"northwlnd" uses an L in place of the I. The bank\'s real domain is northwindbank.com.',
      },
      {
        match: 'Dear Customer',
        type: 'generic-greeting',
        note: 'Your real bank knows your name and uses it.',
      },
      {
        match: 'confirm your password and card details',
        type: 'asks-for-credentials',
        note: 'Banks never ask for your password or card details by email.',
      },
      {
        match: 'within 24 hours or your account will be permanently closed',
        type: 'urgency',
        note: 'A countdown and a threat are there to rush you before you think.',
      },
      {
        match: 'northwindbank.com/restore',
        type: 'mismatched-link',
        note: 'The link text shows the real bank, but hover it: it actually goes to northwlnd-secure.com.',
      },
    ],
  },
  {
    id: 'bank-statement-legit',
    kind: 'email',
    from: { name: 'Northwind Bank', address: 'statements@northwindbank.com' },
    subject: 'Your October statement is ready',
    body: [
      'Hi Jordan,',
      'Your October statement for the checking account ending in 4821 is now available.',
      'You can {{0}} in online banking or the Northwind app.',
      'Reminder: we will never ask for your password by email.',
      'Northwind Bank',
    ].join('\n\n'),
    links: [{ text: 'view your statement', realUrl: 'https://www.northwindbank.com/statements' }],
    isPhish: false,
    highlights: [
      {
        match: 'statements@northwindbank.com',
        note: "Sent from the bank's real domain, spelled correctly.",
      },
      {
        match: 'Hi Jordan',
        note: 'Addresses you by name.',
      },
      {
        match: 'ending in 4821',
        note: 'Shows only the last few digits, information the real bank has and a scammer usually would not.',
      },
      {
        match: 'we will never ask for your password by email',
        note: 'Nothing here asks you to hand over credentials.',
      },
      {
        match: 'view your statement',
        note: 'Hover the link: it really goes to northwindbank.com.',
      },
    ],
  },
  {
    id: 'parcel-fee-phish',
    kind: 'text',
    from: { name: 'Unknown', address: '+1 (555) 014-2290' },
    body: 'ParcelPoint: your package is on hold for an unpaid $1.99 redelivery fee. Pay today to avoid return to sender: {{0}}',
    links: [{ text: 'parcelpoint-redelivery.co/pay', realUrl: 'http://parcelpoint-redelivery.co/pay?trk=PP19920' }],
    isPhish: true,
    highlights: [
      {
        match: '+1 (555) 014-2290',
        type: 'lookalike-sender',
        note: 'Delivery companies text from short codes, not a random personal number.',
      },
      {
        match: 'Pay today to avoid return to sender',
        type: 'urgency',
        note: 'A tiny fee plus a deadline is a classic way to rush you into paying.',
      },
      {
        match: 'parcelpoint-redelivery.co',
        type: 'mismatched-link',
        note: 'Not ParcelPoint\'s own site: "-redelivery.co" is a separate domain anyone can register.',
      },
    ],
  },
];
