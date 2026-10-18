// Building blocks shared by the screens, styled only with design-system tokens.
import type { ReactNode, Ref } from 'react';
import { FLAG_LABELS } from '../../../shared/flags.ts';
import type { Message } from '../../../shared/messages.ts';
import type { TeacherCredentials } from '../class/dashboardLink.ts';
import type { StoredClass } from '../class/storage.ts';
import { Badge } from '../components/Badge.tsx';
import {
  ChalkboardIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  FishIcon,
  FlagIcon,
  HookIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from '../components/icons.tsx';
import type { Answer } from '../game/types.ts';
import type { verdictFor } from '../game/usePlayState.ts';
import type { ClassSession } from '../screens/JoinScreen.tsx';

type Variant = 'primary' | 'secondary' | 'accent' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

/** Class names for a design-system button (secondary, medium by default). */
export const button = (variant: Variant = 'secondary', size: Size = 'md') =>
  ['hk-btn', variant !== 'secondary' && `hk-btn--${variant}`, size !== 'md' && `hk-btn--${size}`].filter(Boolean).join(' ');

/** "Hooked" with the hook badge. The text is the accessible name. */
export function Wordmark({ size, bob = false }: { size: 'sm' | 'lg'; bob?: boolean }) {
  const lg = size === 'lg';
  return (
    <span className={`inline-flex items-center ${lg ? 'gap-3' : 'gap-2'}`}>
      <span
        className={`grid shrink-0 place-items-center rounded-full bg-logo-badge text-logo-hook ${lg ? 'size-16 sm:size-20' : 'size-9'} ${bob ? 'hk-bob' : ''}`}
      >
        <HookIcon className={lg ? 'size-10 sm:size-12' : 'size-6'} />
      </span>
      <span className={`hk-display text-ink ${lg ? 'text-display' : 'text-heading'}`}>Hooked</span>
    </span>
  );
}

/** A rounded square holding an icon, for headings. */
export function IconTile({ children, tone = 'accent', size = 'md' }: { children: ReactNode; tone?: 'accent' | 'mark' | 'primary' | 'muted'; size?: 'md' | 'lg' }) {
  const tones = {
    accent: 'bg-accent text-on-accent',
    mark: 'bg-mark text-card-ink',
    primary: 'bg-primary text-on-primary',
    muted: 'bg-surface-muted text-card-ink',
  };
  return (
    <span className={`grid shrink-0 place-items-center ${size === 'lg' ? 'size-14 rounded-control' : 'size-10 rounded-chip'} ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** A numbered circle for steps and lists. */
export function StepNumber({ n, label = 'Step' }: { n: number; label?: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-small font-bold text-on-primary">
      <span className="sr-only">{label} </span>
      {n}
    </span>
  );
}

/** Info or error message. Put it inside a live region when it appears after an action. */
export function Notice({ tone = 'info', children, id }: { tone?: 'info' | 'error'; children: ReactNode; id?: string }) {
  return (
    <p
      id={id}
      className={`flex items-start gap-3 rounded-control px-5 py-3 text-small ${tone === 'error' ? 'bg-bad text-on-bad' : 'bg-raised text-ink'}`}
    >
      {tone === 'error' && <XCircleIcon className="mt-0.5 size-5 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="hk-focus inline-flex items-center gap-1 self-start rounded-chip text-small font-bold text-ink-muted hover:text-ink">
      <ChevronLeftIcon className="size-4" />
      Back
    </button>
  );
}

export function Key({ children }: { children: ReactNode }) {
  return <kbd className="hk-key">{children}</kbd>;
}

export function KeysHint() {
  return (
    <p className="hidden items-center gap-2 text-small text-ink-muted sm:flex">
      Keys <Key>P</Key> phish <Key>L</Key> legit <Key>Enter</Key> next
    </p>
  );
}

export function Situation({ text }: { text: string }) {
  return (
    <p className="rounded-card bg-raised px-5 py-4 text-small text-ink">
      <span className="font-bold text-accent">Situation: </span>
      {text}
    </p>
  );
}

/** Shown on the first message with a link in each round, before it's answered. */
export function LinkTip() {
  return (
    <p className="rounded-card bg-raised px-5 py-4 text-small text-ink">
      <span className="font-bold text-accent">Tip: </span>
      Before you click, check where a link really goes. Hover over it on a computer, or press and hold it on a phone.
    </p>
  );
}

const ANSWERS = [
  { variant: 'phish', label: 'Phish', meaning: 'Scam', shortcut: 'P', guessedPhish: true, Icon: FishIcon },
  { variant: 'legit', label: 'Legit', meaning: 'Real', shortcut: 'L', guessedPhish: false, Icon: ShieldCheckIcon },
] as const;

export function AnswerButtons({ answer, onChoose }: { answer: Answer | undefined; onChoose: (guessedPhish: boolean) => void }) {
  return (
    <div role="group" aria-label="Is this message a phish or legit?" className="grid grid-cols-2 gap-4">
      {ANSWERS.map(({ variant, label, meaning, shortcut, guessedPhish, Icon }) => {
        const chosen = answer?.guessedPhish === guessedPhish;
        const wrongPick = answer !== undefined && answer.guessedPhish !== answer.message.isPhish;
        // After a wrong pick, the other button is the right answer: keep it bright and say so.
        const state = !answer ? 'idle' : chosen ? 'chosen' : wrongPick ? 'right' : 'faded';
        return (
          <button
            key={variant}
            type="button"
            className="hk-answer"
            data-variant={variant}
            data-state={state}
            data-correct={chosen ? String(!wrongPick) : undefined}
            disabled={answer !== undefined}
            aria-keyshortcuts={shortcut}
            onClick={() => onChoose(guessedPhish)}
          >
            <span className="flex items-center gap-2">
              <Icon className="size-7" />
              {label}
            </span>
            {/* The plain meaning, at every width: not every 12-year-old knows "phish" and "legit". */}
            <span className="font-body text-small font-bold">{meaning}</span>
            <span className="font-body text-micro">
              {chosen ? (
                'Your answer'
              ) : state === 'right' ? (
                <span className="inline-flex items-center gap-1 text-small font-bold">
                  <CheckCircleIcon className="size-5" />
                  Right answer
                </span>
              ) : (
                <span className="hidden sm:inline">Press {shortcut}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Verdict({
  verdict,
  boxRef,
}: {
  verdict: ReturnType<typeof verdictFor> | undefined;
  boxRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={boxRef} aria-live="polite" aria-atomic="true" className="scroll-mt-4">
      {verdict && (
        <p
          className={`hk-reveal-pop flex items-start gap-3 rounded-card px-5 py-4 ${verdict.correct ? 'bg-good text-on-good' : 'bg-bad text-on-bad'}`}
        >
          {verdict.correct ? <CheckCircleIcon className="mt-0.5 size-7 shrink-0" /> : <XCircleIcon className="mt-0.5 size-7 shrink-0" />}
          <span>
            <span className="hk-display block text-title">{verdict.headline}</span>
            <span className="text-body">{verdict.detail}</span>
          </span>
        </p>
      )}
    </div>
  );
}

/** The numbered red flags (or signs it's safe) shown after answering. */
export function Notes({ message }: { message: Message }) {
  const tone = message.isPhish ? 'flag' : 'safe';
  return (
    <section aria-labelledby="notes-heading" className="hk-card hk-reveal-rise p-5 sm:p-6">
      <h3 id="notes-heading" className="hk-display flex items-center gap-3 text-title">
        <IconTile tone={message.isPhish ? 'mark' : 'accent'}>
          {message.isPhish ? <FlagIcon className="size-6" /> : <ShieldCheckIcon className="size-6" />}
        </IconTile>
        {message.isPhish ? 'Red flags' : 'Why it’s safe'}
      </h3>
      <ol role="list" className="mt-4 flex flex-col gap-4">
        {message.highlights.map((h, i) => (
          <li key={i} className="flex gap-3">
            <Badge n={i + 1} tone={tone} className="mt-0.5" />
            <div>
              {h.type && <p className="text-body font-bold">{FLAG_LABELS[h.type]}</p>}
              <p className="text-small text-card-ink-muted">{h.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function NextButton({ buttonRef, isLast, onNext }: { buttonRef: Ref<HTMLButtonElement>; isLast: boolean; onNext: () => void }) {
  return (
    <button ref={buttonRef} type="button" onClick={onNext} className={button('primary', 'lg')}>
      {isLast ? 'See results' : 'Next'}
      <span aria-hidden>→</span>
    </button>
  );
}

/** A new player's rejoin code, shown once. */
export function RejoinNotice({ code, headingRef, onDismiss }: { code: string; headingRef: Ref<HTMLHeadingElement>; onDismiss: () => void }) {
  return (
    <section aria-labelledby="rejoin-code-heading" className="hk-card border-4 border-primary p-5 text-left">
      <h2 id="rejoin-code-heading" ref={headingRef} tabIndex={-1} className="hk-display text-heading outline-none">
        Your rejoin code: <span className="sr-only">{code.split('').join(' ')}</span>
        <span aria-hidden className="ml-1 font-code text-title tracking-[0.2em]">
          {code}
        </span>
      </h2>
      <p className="mt-1 text-small text-card-ink-muted">Write it down to keep playing on another device. It’s shown only once.</p>
      <button type="button" onClick={onDismiss} className={`${button('secondary', 'sm')} mt-4`}>
        I wrote it down
      </button>
    </section>
  );
}

type TextButtonProps = { onClick: () => void; children: ReactNode; buttonRef?: Ref<HTMLButtonElement>; className?: string };

/** A button that reads as a link. It takes its color from where it sits. */
export function TextButton({ onClick, children, buttonRef, className = '' }: TextButtonProps) {
  return (
    <button ref={buttonRef} type="button" onClick={onClick} className={`hk-link ${className}`}>
      {children}
    </button>
  );
}

export function SessionLine({ session, onLeave }: { session: ClassSession; onLeave: () => void }) {
  return (
    <p className="rounded-card bg-raised px-5 py-4 text-small text-ink">
      Playing in class <span className="font-code font-bold">{session.code}</span> as <strong>{session.nickname}</strong>.{' '}
      <TextButton onClick={onLeave}>Leave class</TextButton>
    </p>
  );
}

export function SavedClasses({ classes, onOpen }: { classes: StoredClass[]; onOpen: (c: TeacherCredentials) => void }) {
  return (
    <section aria-labelledby="my-classes-heading" className="hk-card p-5 sm:p-6">
      <h2 id="my-classes-heading" className="hk-display flex items-center gap-3 text-heading">
        <IconTile tone="muted">
          <ChalkboardIcon className="size-6" />
        </IconTile>
        Your classes on this device
      </h2>
      <ul className="mt-4 divide-y divide-line">
        {classes.map((c) => (
          <li key={c.code} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span>
              <span className="font-code text-heading font-bold tracking-wider">{c.code}</span>
              <span className="ml-2 text-small text-card-ink-muted">
                created {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onOpen({ code: c.code, teacherKey: c.teacherKey })}
              aria-label={`Open dashboard for class ${c.code}`}
              className={button('secondary', 'sm')}
            >
              Open dashboard
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TeacherLinks({ onTeacher, onTeacherGuide }: { onTeacher: () => void; onTeacherGuide: () => void }) {
  return (
    <p className="text-center text-small text-ink-muted">
      Teaching this?{' '}
      <TextButton onClick={onTeacher} className="text-ink">
        I’m a teacher
      </TextButton>
      {' · '}
      <TextButton onClick={onTeacherGuide} className="text-ink">
        Guide for teachers
      </TextButton>
    </p>
  );
}
