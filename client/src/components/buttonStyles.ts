export const FOCUS_RING =
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

export const PRIMARY_BUTTON = `inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-900 px-6 text-base font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-900 ${FOCUS_RING}`;

export const SECONDARY_BUTTON = `inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-900 hover:bg-slate-100 ${FOCUS_RING}`;
