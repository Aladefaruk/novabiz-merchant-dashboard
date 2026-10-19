import { CalendarDays, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { btnGhost, btnPrimary, input } from '../../shared/components/ui';
import { addDaysToKey, formatDateKey, keyToLocalDate, lagosDateKey, localDateToKey } from '../../shared/lib/dates';

interface Props {
  from?: string; // yyyy-mm-dd (Lagos)
  to?: string;
  onChange: (range: { from?: string; to?: string }) => void;
}

const fieldLabel = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300';
const chip =
  'rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:border-navy-800 aria-pressed:border-navy-800 aria-pressed:bg-navy-800 aria-pressed:text-white dark:border-slate-500 dark:hover:border-gold-400 dark:aria-pressed:border-gold-400 dark:aria-pressed:bg-gold-400 dark:aria-pressed:text-navy-950';

function rangeLabel(from?: string, to?: string): string {
  if (!from) return 'All dates';
  if (!to || to === from) return formatDateKey(from);
  return `${formatDateKey(from)} – ${formatDateKey(to)}`;
}

/** One "Date range" control: quick presets plus a calendar, instead of separate From / To fields. */
export function DateRangeFilter({ from, to, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const panelId = useId();

  // "Today" is the merchant's Lagos day, whatever timezone the phone is set to.
  const today = lagosDateKey(new Date());
  const presets = [
    { label: 'Today', from: today, to: today },
    { label: 'Yesterday', from: addDaysToKey(today, -1), to: addDaysToKey(today, -1) },
    { label: 'Last 7 days', from: addDaysToKey(today, -6), to: today },
    { label: 'Last 30 days', from: addDaysToKey(today, -29), to: today },
    { label: 'This month', from: `${today.slice(0, 8)}01`, to: today },
  ];

  // Close on Escape (focus back to the button) or a click outside.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selected: DateRange | undefined = from ? { from: keyToLocalDate(from), to: keyToLocalDate(to ?? from) } : undefined;

  const onSelect = (range: DateRange | undefined) => {
    if (!range?.from) return onChange({});
    const start = localDateToKey(range.from);
    onChange({ from: start, to: range.to ? localDateToKey(range.to) : start });
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <span id={labelId} className={fieldLabel}>Date range</span>
      <button
        ref={buttonRef}
        type="button"
        className={`${input} flex items-center gap-2 text-left`}
        aria-labelledby={`${labelId} ${labelId}-value`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarDays aria-hidden className="size-4 shrink-0 text-slate-500" />
        <span id={`${labelId}-value`} className="min-w-0 flex-1 truncate">{rangeLabel(from, to)}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-slate-500" />
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Choose a date range"
          className="absolute top-full right-0 left-0 z-30 mt-2 space-y-3 sm:right-auto sm:w-max rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-navy-700 dark:bg-navy-900"
        >
          <div className="flex max-w-72 flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                className={chip}
                aria-pressed={from === p.from && (to ?? from) === p.to}
                onClick={() => {
                  onChange({ from: p.from, to: p.to });
                  close();
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <DayPicker
            mode="range"
            selected={selected}
            onSelect={onSelect}
            defaultMonth={selected?.from ?? keyToLocalDate(today)}
            disabled={{ after: keyToLocalDate(today) }}
            endMonth={keyToLocalDate(today)}
            weekStartsOn={1}
          />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-navy-700">
            <button type="button" className={btnGhost} onClick={() => onChange({})}>Clear dates</button>
            <button type="button" className={btnPrimary} onClick={close}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
