export type FlagType =
  | 'lookalike-sender'
  | 'urgency'
  | 'mismatched-link'
  | 'asks-for-credentials'
  | 'generic-greeting'
  | 'too-good-to-be-true'
  | 'unexpected-attachment';

// `match` must be an exact substring of the message, found exactly once across
// from.name, from.address, subject (emails only) and the rendered body (link tokens
// replaced by link text). Run `npm run check:messages`.
export type Highlight = { match: string; type?: FlagType; note: string };

// Rendered as a <FakeLink>, never a real <a>. Placed inline where the body has
// {{i}} (its index in `links`); every link must be referenced exactly where it shows.
export type FakeLink = { text: string; realUrl: string };

export type Message = {
  id: string;
  kind: 'email' | 'text' | 'dm';
  // email: display name + email address. text: contact name + phone number.
  // dm: display name + @username.
  from: { name: string; address: string };
  subject?: string; // emails only; texts and DMs have no subject
  // Optional scene-setting shown above the message ("Situation: ..."), visible before
  // answering. Not part of the message itself, so highlights can't point into it.
  context?: string;

  body: string;
  links: FakeLink[];
  isPhish: boolean;
  highlights: Highlight[]; // red flags for phish, safe signs for legit
};

export const messages: Message[] = [
  {
    id: "real-code-legit",
    kind: "text",
    context: "You're logging in to Glimmerforge on your new phone.",
    from: { name: "Glimmerforge", address: "55501" },
    body:
      "Glimmerforge: 482913 is your login code. " +
      "Don't share this code with anyone. Glimmerforge will never ask you for it.",
    links: [],
    isPhish: false,
    highlights: [
      {
        match: "482913 is your login code",
        note: "You just tried to log in, so you expected this. A code you didn't ask for means someone else is trying to get in.",
      },
      {
        match: "Don't share this code with anyone.",
        note: 'Real services tell you never to share codes. Anyone who asks for one, even a "friend," is trying to get into your account.',
      },
    ],
  },
  {
    id: "hacked-friend-dm-phish",
    kind: "dm",
    context:
      "Jayden is a friend from school. You usually just talk about games.",
    from: { name: "Jayden", address: "@jaydenplays" },
    body: "yo is this u in this video?? everyone is sharing it {{0}}",
    links: [
      {
        text: "clipz.watch/v/8Hq2",
        realUrl: "https://clipz-watch.login-verify.co/v/8Hq2",
      },
    ],
    isPhish: true,
    highlights: [
      {
        match: "is this u in this video??",
        type: "urgency",
        note: "Panic gets you to click before you think. If it doesn't sound like your friend, ask them another way, like in person or by text.",
      },
      {
        match: "clipz.watch/v/8Hq2",
        type: "mismatched-link",
        note: "It looks like a video link, but it goes to login-verify.co. A video site that makes you log in first is a trap.",
      },
    ],
  },
];
