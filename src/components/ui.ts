/** Shared Tailwind class strings, so buttons/inputs look the same everywhere. */
export const card =
  'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-navy-700 dark:bg-navy-900';

const btn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50';
export const btnPrimary = `${btn} bg-navy-800 text-white hover:bg-navy-700 dark:bg-gold-400 dark:text-navy-950 dark:hover:bg-gold-300`;
export const btnSecondary = `${btn} border border-slate-400 bg-white hover:bg-slate-50 dark:border-slate-500 dark:bg-transparent dark:hover:bg-navy-800`;
export const btnGhost = `${btn} hover:bg-slate-100 dark:hover:bg-navy-800`;

export const label = 'block text-sm font-semibold mb-1';
export const input =
  'w-full min-w-0 rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-base aria-[invalid=true]:border-red-700 dark:border-slate-500 dark:bg-navy-950 dark:aria-[invalid=true]:border-red-400';
export const hint = 'mt-1 text-sm text-slate-600 dark:text-slate-400';
export const errorText = 'mt-1 text-sm font-semibold text-red-700 dark:text-red-400';
