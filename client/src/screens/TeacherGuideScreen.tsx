import { useEffect, useRef, type ReactNode } from 'react';
import { CLASS_IDLE_DAYS } from '../../../shared/api.ts';
import { ChalkboardIcon, ClockIcon, LockIcon } from '../components/icons.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { IconTile, StepNumber } from '../design/parts.tsx';

/** Shareable address for this page: <site>/#for-teachers */
export const TEACHER_GUIDE_HASH = '#for-teachers';

const PLAN: { minutes: string; title: string; body: ReactNode }[] = [
  {
    minutes: 'Before class · 2 min',
    title: 'Create a class',
    body: (
      <>
        On the start screen choose <strong>I’m a teacher</strong>, then <strong>Create a class</strong>. Open the
        dashboard link in a tab only you can see, and save it somewhere safe: it can’t be recovered. If it leaks, use{' '}
        <strong>Get a new link</strong> on the dashboard; the old one stops working and your results stay.
      </>
    ),
  },
  {
    minutes: '3 min',
    title: 'Project the QR code',
    body: (
      <>
        Press <strong>Full screen</strong> under the QR code so only the code shows, not your browser. Students scan the
        code, or go to the link and type the class code, then pick a nickname. Ask for nicknames, not full names. Names appear on your dashboard as students join, and you can remove any that aren’t okay.
      </>
    ),
  },
  {
    minutes: '7–10 min',
    title: 'Students play',
    body: (
      <>
        Each student sorts the messages into <strong>Phish</strong> or <strong>Legit</strong> and sees the red flags (or
        the signs it’s safe) after every answer. Fast finishers can play again or try the password check. Your dashboard
        shows each student’s first score (before they’d seen any answers) and their best; Passed uses the best. If a
        student refreshes the page, they stay in the class. If they close the tab, the join link picks up where they left
        off; on another device they use the rejoin code they were shown when they joined (you can reset it from the
        dashboard; the new code stays hidden until you press <strong>Show code</strong>, so it’s safe while projecting).
        Latecomers can still join: press <strong>Show QR code</strong> on the dashboard.
      </>
    ),
  },
  {
    minutes: '5 min',
    title: 'Review the dashboard together',
    body: (
      <>
        Once everyone has finished (the <strong>Per message</strong> section shows which messages are phish, so it’s an
        answer key), project the <strong>Most-missed red flags</strong> and <strong>Per message</strong> sections and
        talk through the messages your class found hardest. Both use each
        student’s first run, so replays don’t hide what fooled people. Set a passing score if you like (80% by default,
        checked against each student’s best run) and use <strong>Export CSV</strong> to keep a record. Once the dashboard is open, the address bar shows only the class code, not your
        private key, so it’s fine on a projector. Scroll past the player list if you’d rather not show individual
        scores.
      </>
    ),
  },
  {
    minutes: 'After class',
    title: 'Delete the class, or let it expire',
    body: (
      <>
        Use <strong>Delete class</strong> at the bottom of the dashboard, or leave it: it deletes itself after{' '}
        {CLASS_IDLE_DAYS} days without use.
      </>
    ),
  },
];

const QUESTIONS = [
  'Which message fooled the most people in our class? What made it convincing?',
  'A link’s text and where it really goes can be different. How can you check before you tap?',
  'Why do scammers try to rush you? What could you do instead when a message says “act now”?',
  'A friend’s account sends you a strange link. How could you check it’s really them without replying in the same chat?',
  'Someone asks you for a code that was texted to you. What could they do with it, and who would you tell?',
];

export function TeacherGuideScreen({ onBack }: { onBack: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section aria-labelledby="guide-heading" className="flex flex-col gap-6">
      <ScreenHeader id="guide-heading" headingRef={headingRef} icon={<ChalkboardIcon className="size-7" />} title="For teachers" onBack={onBack}>
        How to run Hooked in one 15 to 20 minute class period, what it stores, and questions for afterwards.
      </ScreenHeader>

      <Section id="plan-heading" icon={<ClockIcon className="size-6" />} title="One class period">
        <ol className="mt-5 flex flex-col gap-5">
          {PLAN.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <StepNumber n={i + 1} />
              <div>
                <p className="text-micro font-bold tracking-wide text-card-ink-muted uppercase">{step.minutes}</p>
                <h4 className="hk-display text-heading">{step.title}</h4>
                <p className="mt-1 text-small text-card-ink-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="data-heading" icon={<LockIcon className="size-6" />} tone="mark" title="What’s stored, and for how long">
        <ul className="mt-5 flex list-disc flex-col gap-2 pl-5 text-small text-card-ink-muted marker:text-card-ink">
          <li>
            <strong className="text-card-ink">For each student:</strong> the nickname they type, when they joined, a scrambled
            (hashed) copy of their rejoin code, and their answers in each attempt (which message, phish or legit, whether it
            was right, and when). Hooked doesn’t ask for names, emails, or accounts.
          </li>
          <li>
            <strong className="text-card-ink">For the class:</strong> a 6-character code, a scrambled (hashed) copy of your
            dashboard key, the passing score you set, and when the class was created and last used.
          </li>
          <li>
            <strong className="text-card-ink">How long:</strong> until you delete the class, or {CLASS_IDLE_DAYS} days after
            it was last used (a student joining or answering, or you opening the dashboard). The dashboard shows the date.
          </li>
          <li>
            <strong className="text-card-ink">Playing without a class code</strong> doesn’t send any answers to Hooked’s
            server.
          </li>
          <li>
            <strong className="text-card-ink">On this device:</strong> the browser remembers classes you created here
            (including the dashboard key) and which player a student is in each class, so both can pick up where they left
            off. On a shared computer, delete the class when you’re done or use a private window.
          </li>
          <li>
            <strong className="text-card-ink">Password check:</strong> passwords are never stored or sent. Only the first 5
            characters of the password’s hash leave the device, to look it up in Have I Been Pwned. The student’s browser
            contacts Have I Been Pwned (served through Cloudflare) directly, and only when they press Check, so that service
            sees the device’s IP address, as any website does. Hooked’s server isn’t involved.
          </li>
          <li>
            Like any website, the hosting provider keeps standard request logs, which include IP addresses. Hooked’s own logs
            don’t record them and its database never saves them. To slow down abuse, the server briefly keeps a count of
            requests per address in memory; it’s never written to disk and is gone within about two hours.
          </li>
        </ul>
      </Section>

      <Section id="questions-heading" icon={<ChalkboardIcon className="size-6" />} tone="primary" title="Discussion questions">
        <ol className="mt-5 flex list-decimal flex-col gap-2 pl-5 text-small text-card-ink-muted marker:font-bold marker:text-card-ink">
          {QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </Section>

      <p className="rounded-card bg-raised px-5 py-4 text-small text-ink-muted">
        <strong className="text-ink">All people, companies, and schools in the game are made up.</strong> Links in the
        game never open.
      </p>
    </section>
  );
}

type SectionProps = { id: string; icon: ReactNode; tone?: 'accent' | 'mark' | 'primary'; title: string; children: ReactNode };

function Section({ id, icon, tone = 'accent', title, children }: SectionProps) {
  return (
    <section aria-labelledby={id} className="hk-card p-5 sm:p-6">
      <h3 id={id} className="hk-display flex items-center gap-3 text-heading">
        <IconTile tone={tone}>{icon}</IconTile>
        {title}
      </h3>
      {children}
    </section>
  );
}
