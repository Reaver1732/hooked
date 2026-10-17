// Small decorative icons (always aria-hidden; the text next to them carries meaning).
import type { ReactNode } from 'react';

type IconProps = { className?: string };

function Icon({ className = 'size-5', children, fill = false }: IconProps & { children: ReactNode; fill?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** The Hooked mark: a fishing hook hanging from its line. */
export function HookIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M15 1v2.5" />
      <circle cx="15" cy="5" r="1.8" />
      <path d="M15 6.8V15a5.5 5.5 0 0 1-11 0v-3l3.2 3.2" />
    </Icon>
  );
}

export function FishIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M2.5 12c2.6-3.6 5.9-5.5 9.5-5.5 3.9 0 7 2.4 8.5 5.5-1.5 3.1-4.6 5.5-8.5 5.5-3.6 0-6.9-1.9-9.5-5.5Z" />
      <path d="M20.5 12 23 8.5v7Z" />
      <circle cx="7.5" cy="11" r=".9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function ShieldCheckIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6Z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </Icon>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m7.5 12.5 3 3 6-6.5" />
    </Icon>
  );
}

export function XCircleIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Icon>
  );
}

export function FlagIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </Icon>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </Icon>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.3 2.4 3.6 5.2" />
    </Icon>
  );
}

export function ChalkboardIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="2.5" y="3.5" width="19" height="13" rx="1.5" />
      <path d="M8 20.5 10 16.5M16 20.5l-2-4M7 8h6M7 11.5h9" />
    </Icon>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3" />
    </Icon>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m15 5-7 7 7 7" />
    </Icon>
  );
}

export function InboxIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3 13.5 5.5 5h13l2.5 8.5V19H3Z" />
      <path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5" />
    </Icon>
  );
}

export function ArchiveIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3" y="4" width="18" height="4.5" rx="1" />
      <path d="M5 8.5V20h14V8.5M10 12.5h4" />
    </Icon>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M21 3 10 14M21 3l-7 18-4-7-7-4Z" />
    </Icon>
  );
}

export function SignalIcons({ className = 'h-3 w-12' }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 48 12" className={className} fill="currentColor">
      <rect x="0" y="8" width="2.5" height="4" rx=".5" />
      <rect x="4" y="5.5" width="2.5" height="6.5" rx=".5" />
      <rect x="8" y="3" width="2.5" height="9" rx=".5" />
      <rect x="12" y="0.5" width="2.5" height="11.5" rx=".5" />
      <rect x="26" y="1.5" width="18" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="28" y="3.5" width="12" height="5" rx="1" />
      <rect x="45" y="4.5" width="1.6" height="3" rx=".6" />
    </svg>
  );
}

export function LifebuoyIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="m5.3 5.3 3.9 3.9M14.8 14.8l3.9 3.9M18.7 5.3l-3.9 3.9M9.2 14.8l-3.9 3.9" />
    </Icon>
  );
}
