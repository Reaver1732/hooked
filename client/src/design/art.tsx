// Hooked illustrations: flat, chunky shapes in the design-system palette. Decorative only.

/** A fish eyeing an email dangling on a hook, with bubbles and seaweed. */
export function ReefScene({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 320 220" className={className} strokeLinecap="round" strokeLinejoin="round">
      {/* Seabed and seaweed */}
      <rect x="8" y="206" width="304" height="14" rx="7" className="fill-raised" />
      <path d="M292 214c-12-18 12-30 0-48s12-30 0-48" className="fill-none stroke-accent" strokeWidth="7" />
      <path d="M308 214c-8-14 8-22 0-36" className="fill-none stroke-mark" strokeWidth="6" />
      <path d="M18 214c8-12-8-20 0-32" className="fill-none stroke-mark" strokeWidth="6" />

      {/* Line, then the bait (an email hooked by its corner), then the hook in front */}
      <path d="M250 0v40" className="stroke-ink-muted" strokeWidth="3" />
      <circle cx="250" cy="46" r="6" className="fill-none stroke-primary" strokeWidth="6" />
      <g transform="rotate(-20 204 118)">
        <rect x="132" y="118" width="72" height="48" rx="8" className="fill-surface stroke-card-ink" strokeWidth="4" />
        <path d="m135 123 33 22 33-22" className="fill-none stroke-card-ink" strokeWidth="4" />
      </g>
      <path d="M250 52v68a24 24 0 0 1-48 0v-16l14 14" className="fill-none stroke-primary" strokeWidth="9" />
      <circle cx="222" cy="167" r="12" className="fill-mark" />
      <path d="M222 160.5v7" className="stroke-card-ink" strokeWidth="4" />
      <circle cx="222" cy="173.5" r="2.2" className="fill-card-ink" />

      {/* Bubbles */}
      <circle cx="128" cy="120" r="5" className="hk-bubble fill-none stroke-ink-muted" strokeWidth="3" />
      <circle cx="116" cy="92" r="7" className="hk-bubble fill-none stroke-ink-muted" strokeWidth="3" style={{ animationDelay: '-1.3s' }} />
      <circle cx="132" cy="62" r="4" className="hk-bubble fill-none stroke-ink-muted" strokeWidth="3" style={{ animationDelay: '-2.6s' }} />

      {/* The fish */}
      <path d="M34 165 8 144l6 21-6 21Z" className="fill-mark" />
      <path d="M72 136c8-20 26-22 36-14-10 2-16 8-18 12Z" className="fill-mark" />
      <path d="M30 165c18-25 42-33 64-33s38 16 44 33c-6 17-22 33-44 33s-46-8-64-33Z" className="fill-accent" />
      <path d="M88 146c-8 19-8 19 0 38" className="fill-none stroke-card-ink" strokeWidth="3" opacity=".35" />
      <circle cx="112" cy="156" r="9" className="fill-surface" />
      <circle cx="115" cy="156" r="4.5" className="fill-card-ink" />
      <path d="M137 169q-7 3-13 0" className="fill-none stroke-card-ink" strokeWidth="3" />
    </svg>
  );
}
