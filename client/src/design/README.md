# Hooked design system ("Arcade Reef")

Hooked should feel like a game: deep navy water, coral and electric teal, a sun-yellow main action, chunky rounded buttons that press in, and a bold rounded display font. Everything visual comes from a small set of tokens, so the whole app can be retuned from one file.

- `tokens.css`: the tokens (`--hk-*` custom properties) and the Tailwind mapping (`@theme inline`) that turns them into utilities like `bg-canvas`, `text-title` and `rounded-card`. It also loads the two self-hosted fonts.
- `components.css`: the component classes (`.hk-btn`, `.hk-answer`, `.hk-card`, `.hk-input`, `.hk-link`, `.hk-key`, `.hk-display`, `.hk-focus`), the page base, and all motion.
- `parts.tsx`: shared React pieces built from those (wordmark, notices, icon tiles, answer buttons, verdict, notes, rejoin notice and more), plus `button(variant, size)`.
- `art.tsx`: the reef illustration on the start screen.

**The one exception:** the message mockups (`src/components/MessageView.tsx`, `HighlightedText`, `Badge`, `FakeLink`, `AttachmentChip`, `Tooltip`) imitate a mail app, a phone and a chat app. They keep their own neutral app styling and a system font, so a message still looks like the app it came from.

## Color

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#0d1b3e` | Page background |
| `raised` | `#172b5c` | Panels on the canvas (progress, situation, notices, score) |
| `ink` / `ink-muted` | `#ffffff` / `#c3ceee` | Text on canvas and raised panels |
| `surface` / `surface-muted` | `#ffffff` / `#eef2fb` | Cards, and wells inside cards |
| `card-ink` / `card-ink-muted` | `#0d1b3e` / `#46527a` | Text on cards |
| `line` | `#d5dcef` | Dividers in cards |
| `input-border` | `#6d7fb3` | Text field borders |
| `primary` / `on-primary` | `#ffd23f` / navy | The main action on each screen, step numbers, highlights |
| `accent` / `on-accent` | `#2be3c8` / navy | Secondary actions, labels, link underlines on the canvas |
| `accent-soft` | `#233f7d` | Decorative shapes on raised panels |
| `mark` | `#ff6b57` | Logo badge, red-flag tiles, illustration |
| `good` / `bad` (+ `on-…`) | teal / coral, navy text | Legit and correct; phish, wrong and errors |
| `track` / `fill` | `#22386f` / teal | Progress bar |
| `focus` / `focus-on-surface` | white / navy | Focus ring on the canvas / inside cards |

Every text pair meets WCAG AA (the lowest is coral with navy text at 6.0:1), including hover states. Focus rings, field borders and button edges are at least 3:1 against what's behind them. Inside `.hk-card` the focus ring and link underline switch to card colors automatically.

## Type

Fredoka (display) and Nunito (body), both variable fonts from `@fontsource-variable`, self-hosted.

| Token | Size / line height | Use |
| --- | --- | --- |
| `jumbo` | `clamp(3rem, 1.8rem + 6vw, 6rem)` / 1 | Class code on the projector |
| `display` | `clamp(3rem, 2.2rem + 4vw, 4.75rem)` / 0.95 | Wordmark, score, class codes |
| `title` | `clamp(1.5rem, 1.3rem + 1vw, 2rem)` / 1.15 | Screen titles, verdicts, answer buttons |
| `heading` | `1.25rem` / 1.25 | Card headings |
| `body` | `1.0625rem` / 1.55 | Default text |
| `small` | `0.9375rem` / 1.45 | Supporting text |
| `micro` | `0.8125rem` / 1.35 | Labels, hints, captions |

`.hk-display` sets the display family, weight 700 and tracking. Codes use `font-code` (system monospace); messages use `font-message` (system sans).

## Spacing, radius, depth

- Spacing: Tailwind's 4px steps, limited to 1, 2, 3, 4, 5, 6, 8, 10, 12, 16 (4 to 64px). `0.5` (2px) only lines icons up with text.
- Radius: `tight` 6px (keys, inline highlights), `chip` 12px, `control` 18px, `card` 26px.
- Shadow: cards sit on a solid `0 8px 0` navy edge, no blur. Buttons have a 6px solid edge in a darker shade of their color and move down 4px when pressed.

## Components

- **`.hk-btn`** (secondary by default) with `--primary`, `--accent` or `--danger`, and sizes `--sm` (40px), default (48px), `--lg` (56px), `--xl` (64px). Works on `<button>` and `<a>`. One primary per screen.
- **`.hk-answer`** with `data-variant="phish|legit"` and `data-state="idle|chosen|faded"`: the two big choices. The chosen one stays pressed in; the other fades (it's disabled).
- **`.hk-card`**: a white card with the solid edge.
- **`.hk-input`**: text fields (always on a card).
- **`.hk-link`**: a button or link that reads as text, with a thick underline. Takes its color from its surroundings.
- **`.hk-key`**: keyboard hints.
- **`.hk-focus`**: the 3px focus ring, offset 3px, for anything that isn't one of the above.

## Motion

Only inside `@media (prefers-reduced-motion: no-preference)`. With reduced motion nothing animates or transitions, and a safety net in `components.css` enforces that.

- Buttons press in (90ms) and ease their hover color.
- The verdict pops in, the notes rise, highlights fade in, and the progress fill springs forward.
- The logo hook bobs, and bubbles float in the reef illustration.
