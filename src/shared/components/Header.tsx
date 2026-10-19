import { Moon, QrCode, SlidersHorizontal, Sun } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
  mockOpen: boolean;
  onToggleMock: () => void;
}

const headerBtn =
  'inline-flex size-11 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 text-white hover:border-gold-400 sm:w-auto sm:px-3';

export function Header({ theme, onToggleTheme, mockOpen, onToggleMock }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b-4 border-gold-500 bg-navy-900 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gold-500 text-navy-900">
            <QrCode aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold">
              NovaBiz <span className="text-sm font-medium text-gold-300">by FirstBank</span>
            </p>
            <p className="truncate text-xs text-slate-300">Mama Titi’s Kitchen · Yaba</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className={headerBtn} onClick={onToggleMock} aria-expanded={mockOpen} aria-controls="mock-panel" aria-label="Mock API controls">
            <SlidersHorizontal aria-hidden className="size-4" />
            <span aria-hidden className="hidden text-sm font-semibold sm:inline">
              Mock API
            </span>
          </button>
          <button
            type="button"
            className={headerBtn}
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
