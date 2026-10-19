import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import { btnSecondary } from './ui';

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'timeout') return 'This is taking longer than usual. Your connection may be slow.';
    if (error.kind === 'network') return 'We couldn’t reach NovaPay. Check your internet connection.';
    return error.message;
  }
  return 'Something went wrong.';
}

export function ErrorState({ title, error, onRetry }: { title: string; error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-700 bg-red-50 p-4 dark:border-red-400 dark:bg-red-950/40">
      <AlertTriangle aria-hidden className="size-6 text-red-700 dark:text-red-400" />
      <div className="min-w-48 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{friendlyError(error)}</p>
      </div>
      {onRetry && (
        <button type="button" className={btnSecondary} onClick={onRetry}>
          <RefreshCw aria-hidden className="size-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-400 p-4">
      <Inbox aria-hidden className="size-6 text-slate-500" />
      <div className="min-w-48 flex-1">
        <p className="font-bold">{title}</p>
        {children && <p className="text-sm text-slate-600 dark:text-slate-300">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-md bg-slate-200 dark:bg-navy-700 ${className}`} />;
}
