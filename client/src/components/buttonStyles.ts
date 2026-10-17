// Shared class strings. Colors were checked for WCAG AA (text 4.5:1, focus/borders 3:1).

export const FOCUS_RING =
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

/** On the dark hero the blue ring would vanish; amber stands out against deep blue. */
export const FOCUS_RING_ON_DARK =
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

// Size and variant are separate so callers never stack a second padding or font size
// on top (two classes for one property resolve by CSS order, not class-string order).
const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold disabled:cursor-not-allowed disabled:opacity-50';

const BUTTON_SIZES = {
  sm: 'min-h-10 px-4 text-sm',
  md: 'min-h-12 px-6 text-base',
  lg: 'min-h-14 px-8 text-lg',
};

const BUTTON_VARIANTS = {
  primary: `bg-sky-800 text-white shadow-sm hover:bg-sky-900 disabled:hover:bg-sky-800 ${FOCUS_RING}`,
  secondary: `border border-sky-800/25 bg-white text-sky-900 hover:bg-sky-100 ${FOCUS_RING}`,
  danger: `border border-red-700 bg-white text-red-800 hover:bg-red-50 ${FOCUS_RING}`,
  /** Amber "bobber" button for the dark hero. */
  primaryOnDark: `bg-amber-300 text-slate-900 shadow-sm hover:bg-amber-200 ${FOCUS_RING_ON_DARK}`,
};

export const button = (variant: keyof typeof BUTTON_VARIANTS, size: keyof typeof BUTTON_SIZES = 'md') =>
  `${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]}`;

export const PRIMARY_BUTTON = button('primary');
export const SECONDARY_BUTTON = button('secondary');
export const DANGER_BUTTON = button('danger');

/** Input box without a font size, for inputs that set their own. */
export const INPUT_FRAME = `min-h-12 w-full min-w-0 rounded-lg border border-slate-500 bg-white px-3 ${FOCUS_RING}`;

export const TEXT_INPUT = `${INPUT_FRAME} text-base`;

export const BACK_LINK = `inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-slate-700 hover:text-slate-900 ${FOCUS_RING}`;

export const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
