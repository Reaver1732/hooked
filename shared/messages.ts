export type FlagType =
  | 'lookalike-sender'
  | 'urgency'
  | 'mismatched-link'
  | 'asks-for-credentials'
  | 'generic-greeting'
  | 'too-good-to-be-true'
  | 'unexpected-attachment';

// `match` must be an exact substring of the message, found exactly once across
// from.name, from.address, subject (emails only), the rendered body (link tokens
// replaced by link text) and attachment names (emails only). Run `npm run check:messages`.
export type Highlight = { match: string; type?: FlagType; note: string };

// Rendered as a <FakeLink>, never a real <a>. Placed inline where the body has
// {{i}} (its index in `links`); every link must be referenced exactly where it shows.
export type FakeLink = { text: string; realUrl: string };

// A file chip under an email's body, e.g. { name: "Invoice.pdf.zip", size: "48 KB" }.
// It can never be opened. The name can be highlighted; the size can't.
export type Attachment = { name: string; size: string };

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
  attachments?: Attachment[]; // emails only
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
  {
    id: "package-fee-phish",
    kind: "text",
    context: "Your family orders stuff online all the time.",
    from: { name: "Unknown", address: "(414) 555-0182" },
    body:
      "SwiftParcel: Your package is on hold due to an unpaid $1.99 delivery fee. " +
      "Pay within 24 hours or it will be returned: {{0}}",
    links: [
      {
        text: "swiftparcel-redelivery.com/pay",
        realUrl: "https://swiftparcel-redelivery.com/pay",
      },
    ],
    isPhish: true,
    highlights: [
      {
        match: "$1.99 delivery fee",
        type: "asks-for-credentials",
        note: "A tiny fee feels harmless. The real goal is getting your card number.",
      },
      {
        match: "Pay within 24 hours or it will be returned",
        type: "urgency",
        note: "A short deadline so you pay before you ask a parent whether anything is even coming.",
      },
      {
        match: "swiftparcel-redelivery.com/pay",
        type: "lookalike-sender",
        note: "Delivery companies use their own short website. Extra words like \"-redelivery\" mean it's someone else's site.",
      },
    ],
  },
  {
    id: "game-login-phish",
    kind: "email",
    context: "You play Glimmerforge on your laptop at home.",
    from: {
      name: "Glimmerforge Security",
      address: "security@glimmerforge-support.net",
    },
    subject: "New sign-in to your account",
    body:
      "Hello Player,\n\n" +
      "We noticed a sign-in to your Glimmerforge account from a new device.\n\n" +
      "Device: Windows PC\nLocation: Unrecognized\n\n" +
      "If this wasn't you, secure your account now or it will be locked: {{0}}\n\n" +
      "The Glimmerforge Team",
    links: [
      {
        text: "Secure my account",
        realUrl: "https://glimmerforge-support.net/verify",
      },
    ],
    isPhish: true,
    highlights: [
      {
        match: "security@glimmerforge-support.net",
        type: "lookalike-sender",
        note: 'Glimmerforge\'s real emails come from @glimmerforge.com. Adding "-support" makes it a completely different website.',
      },
      {
        match: "Hello Player",
        type: "generic-greeting",
        note: "Your real game account knows your username.",
      },
      {
        match: "or it will be locked",
        type: "urgency",
        note: "Fear of losing your account is the hook. Scammers want you to act fast.",
      },
      {
        match: "Secure my account",
        type: "asks-for-credentials",
        note: "This button leads to a fake sign-in page. If you're worried, open the game yourself and change your password there.",
      },
    ],
  },
  {
    id: "game-login-legit",
    kind: "email",
    context:
      "You just logged in to Glimmerforge on a friend's computer to show them your base.",
    from: { name: "Glimmerforge", address: "no-reply@glimmerforge.com" },
    subject: "New sign-in to your account",
    body:
      "Hi skybolt_77,\n\n" +
      "Your Glimmerforge account was just signed in on a new device.\n\n" +
      "Device: Windows PC\nWhen: Today at 4:12 PM\n\n" +
      "If this was you, you don't need to do anything.\n\n" +
      "If it wasn't, open the Glimmerforge app and change your password in Settings. " +
      "We will never ask for your password by email.\n\n" +
      "The Glimmerforge Team",
    links: [],
    isPhish: false,
    highlights: [
      {
        match: "no-reply@glimmerforge.com",
        note: "Glimmerforge's real address: just the name, then .com. Nothing added.",
      },
      { match: "Hi skybolt_77", note: "It uses your actual username." },
      {
        match: "If this was you, you don't need to do anything.",
        note: "No threat, no deadline. Real alerts stay calm.",
      },
      {
        match: "open the Glimmerforge app and change your password in Settings",
        note: "It tells you to go there yourself instead of handing you a link.",
      },
    ],
  },
  {
    id: "free-gems-dm-phish",
    kind: "dm",
    context:
      "You're in a big Moonveil Arena fan server, full of people you don't know.",
    from: { name: "Moonveil Rewards", address: "@moonveil.rewards.official" },
    body:
      "Congrats!! You were picked for our anniversary giveaway: 10,000 free Gems! " +
      "To claim, verify your account here within 1 hour: {{0}}\n\n" +
      "Only 50 spots left!",
    links: [
      {
        text: "moonveil-gems.com/claim",
        realUrl: "https://moonveil-gems.com/claim",
      },
    ],
    isPhish: true,
    highlights: [
      {
        match: "@moonveil.rewards.official",
        type: "lookalike-sender",
        note: 'Games announce giveaways in the game, not through random DMs. Putting "official" in a username proves nothing.',
      },
      {
        match: "10,000 free Gems",
        type: "too-good-to-be-true",
        note: "Free currency you didn't earn is the oldest bait there is.",
      },
      {
        match: "within 1 hour",
        type: "urgency",
        note: 'A timer and "only 50 spots left" are there to rush you past thinking.',
      },
      {
        match: "verify your account",
        type: "asks-for-credentials",
        note: '"Verify your account" really means "type your password into our fake page."',
      },
    ],
  },
  {
    id: "snow-day-legit",
    kind: "text",
    context:
      "It snowed a lot overnight. Your family signed up for the district's text alerts.",
    from: { name: "Harbor Pines Schools", address: "67283" },
    body:
      "Harbor Pines Schools: Due to heavy snow, all schools are closed today. " +
      "After-school activities are canceled. Updates at {{0}}",
    links: [
      {
        text: "harborpinesschools.org",
        realUrl: "https://harborpinesschools.org",
      },
    ],
    isPhish: false,
    highlights: [
      {
        match: "all schools are closed today",
        note: "It only gives you information. It doesn't ask you to sign in, pay, or send anything.",
      },
      {
        match: "harborpinesschools.org",
        note: "The link goes exactly where it says: the school's real website.",
      },
    ],
  },
  {
    id: "storage-full-phish",
    kind: "email",
    context: "You use your school account for classwork and saving files.",
    from: { name: "HPSD IT Help Desk", address: "helpdesk@harborpines-it.com" },
    subject: "Your storage is 98% full",
    body:
      "Your school account storage is almost full (14.7 GB of 15 GB).\n\n" +
      "When it's full, you won't be able to send email or save work, and older files may be deleted.\n\n" +
      "Students can upgrade to 50 GB for free: {{0}}\n\n" +
      "HPSD IT Help Desk",
    links: [
      {
        text: "Upgrade my storage",
        realUrl: "https://harborpines-it.com/storage/login",
      },
    ],
    isPhish: true,
    highlights: [
      {
        match: "helpdesk@harborpines-it.com",
        type: "lookalike-sender",
        note: "Your school's IT team uses @harborpinesschools.org like everyone else at school.",
      },
      {
        match: "older files may be deleted",
        type: "urgency",
        note: "Threatening your schoolwork is meant to make you panic and click.",
      },
      {
        match: "Upgrade my storage",
        type: "asks-for-credentials",
        note: "Real storage warnings tell you to delete old files. They don't offer upgrades through a link that asks you to sign in.",
      },
    ],
  },
  {
    id: "field-trip-legit",
    kind: "email",
    context: "Your class is going to the science museum next week.",
    from: { name: "Ms. Ortiz", address: "mortiz@harborpinesschools.org" },
    subject: "Field trip form due Friday",
    body:
      "Hi everyone,\n\n" +
      "Reminder that permission forms for next Thursday's science museum trip are due Friday. " +
      "I sent a paper copy home with you on Monday. If you lost it, there's an extra copy on the table by my door.\n\n" +
      "The $8 fee goes to the front office. Please don't bring cash to my room.\n\n" +
      "Thanks!\nMs. Ortiz",
    links: [],
    isPhish: false,
    highlights: [
      {
        match: "mortiz@harborpinesschools.org",
        note: "Your teacher's real school address.",
      },
      {
        match: "Hi everyone",
        note: "A general greeting is normal when a teacher emails the whole class. It only matters alongside other red flags.",
      },
      {
        match: "there's an extra copy on the table by my door",
        note: "No link, no sign-in. Everything happens in person.",
      },
      {
        match: "The $8 fee goes to the front office.",
        note: "Money gets paid in person at school, not through a link.",
      },
    ],
  },
  {
    id: "scholarship-phish",
    kind: "email",
    context: "You're a high school junior starting to think about college.",
    from: {
      name: "Bright Path Scholarship Foundation",
      address: "awards@brightpath-fund.org",
    },
    subject: "Congratulations! You've been awarded $5,000",
    body:
      "Dear Student,\n\n" +
      "Based on your school records, you have been selected to receive a $5,000 Bright Path Scholarship.\n\n" +
      "To release your award, we need a one-time $25 processing fee and your Social Security number for tax purposes. " +
      "Complete your claim by Friday: {{0}}\n\n" +
      "Bright Path Scholarship Foundation",
    links: [
      {
        text: "Claim my scholarship",
        realUrl: "https://brightpath-awards.net/claim",
      },
    ],
    isPhish: true,
    highlights: [
      {
        match: "Dear Student",
        type: "generic-greeting",
        note: "They claim to have your school records but don't know your name.",
      },
      {
        match:
          "you have been selected to receive a $5,000 Bright Path Scholarship",
        type: "too-good-to-be-true",
        note: "You can't win a scholarship you never applied for.",
      },
      {
        match: "$25 processing fee and your Social Security number",
        type: "asks-for-credentials",
        note: "Real scholarships never charge you to receive money. Paying to get paid is always a scam.",
      },
    ],
  },
  {
    id: "coach-text-legit",
    kind: "text",
    context:
      "You're on the JV soccer team, and Coach Reed's number is saved in your phone.",
    from: { name: "Coach Reed", address: "(920) 555-0164" },
    body:
      "Hey team, practice is moved inside to the small gym today because of the rain. " +
      "Same time, 3:30. Bring indoor shoes if you have them.",
    links: [],
    isPhish: false,
    highlights: [
      {
        match: "Coach Reed",
        note: "A saved contact you already know, texting about something you expected.",
      },
      {
        match: "because of the rain",
        note: "Details you can check yourself: look outside or ask a teammate.",
      },
      {
        match: "Bring indoor shoes if you have them.",
        note: "It doesn't ask for money, codes, passwords, or personal info.",
      },
    ],
  },
  {
    id: "photo-zip-phish",
    kind: "email",
    context: "Picture day at school was two weeks ago.",
    from: {
      name: "Lumen School Photos",
      address: "orders@lumen-photos-delivery.com",
    },
    subject: "Your picture day photos are ready!",
    body:
      "Hi there,\n\n" +
      "Great news, your picture day photos are ready! Open the attached file to preview your photos and choose your package.\n\n" +
      "Special price ends tonight at midnight.\n\n" +
      "Lumen School Photos",
    attachments: [{ name: "Your_Photos_Preview.zip", size: "2.1 MB" }],
    links: [],
    isPhish: true,
    highlights: [
      {
        match: "Hi there",
        type: "generic-greeting",
        note: "The photo company has your name. They'd use it.",
      },
      {
        match: "Your_Photos_Preview.zip",
        type: "unexpected-attachment",
        note: "Photo previews don't come as .zip files. Surprise attachments, especially .zip, .exe, or .html, can install malware or open fake sign-in pages.",
      },
      {
        match: "Special price ends tonight at midnight.",
        type: "urgency",
        note: "A rushed deadline so you open the file before you ask a parent.",
      },
    ],
  },
  {
    id: "shared-doc-legit",
    kind: "email",
    context: "In class today, Mr. Patel said he'd share the lab instructions.",
    from: {
      name: "Mr. Patel (via Harbor Pines Docs)",
      address: "docs-noreply@harborpinesschools.org",
    },
    subject: "Mr. Patel shared a document with you",
    body:
      "Mr. Patel shared a document with you:\n\n" +
      '"Lab 4 Instructions"\n\n' +
      "Read these before class Thursday.\n\n" +
      "{{0}}",
    links: [
      {
        text: "Open in Docs",
        realUrl: "https://docs.harborpinesschools.org/d/lab-4-instructions",
      },
    ],
    isPhish: false,
    highlights: [
      {
        match: "docs-noreply@harborpinesschools.org",
        note: "Sent from the school's real domain.",
      },
      {
        match: "Lab 4 Instructions",
        note: "Exactly what he said he'd send. You were expecting it.",
      },
      {
        match: "Open in Docs",
        note: 'Goes to docs.harborpinesschools.org, the real school site. You can also just open Docs yourself and find it under "Shared with me."',
      },
    ],
  },
  {
    id: "remote-job-dm-phish",
    kind: "dm",
    context: "You posted that you're looking for a part-time job.",
    from: {
      name: "Hiring Team | Northline Careers",
      address: "@northline.careers.hr",
    },
    body:
      "Hi! We saw your post. We have a remote assistant job, $400/week, only 5 hours a week, no experience needed. " +
      "To get started, send us your full name, address, phone number, and a photo of your ID so we can set up direct deposit. " +
      "Spots fill fast!",
    links: [],
    isPhish: true,
    highlights: [
      {
        match: "$400/week, only 5 hours a week, no experience needed",
        type: "too-good-to-be-true",
        note: "That's $80 an hour with no experience. Real jobs don't pay like that.",
      },
      {
        match:
          "send us your full name, address, phone number, and a photo of your ID",
        type: "asks-for-credentials",
        note: "Real employers don't hire through DMs or ask for your ID there. This is how identity theft starts.",
      },
      {
        match: "Spots fill fast!",
        type: "urgency",
        note: "Pressure to answer before you can tell a parent.",
      },
    ],
  },
];
