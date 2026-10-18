import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import { Icon } from './Icon';

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'timeout') return 'This is taking longer than usual. Your connection may be slow.';
    if (error.kind === 'network') return 'We couldn’t reach NovaPay. Check your internet connection.';
    return error.message;
  }
  return 'Something went wrong.';
}

export function ErrorState({ title, error, onRetry, compact }: { title: string; error: unknown; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className={`state state--error${compact ? ' state--compact' : ''}`} role="alert">
      <Icon name="alert" size={compact ? 18 : 28} />
      <div>
        <p className="state__title">{title}</p>
        <p className="state__body">{friendlyError(error)}</p>
      </div>
      {onRetry && (
        <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
          <Icon name="refresh" size={16} /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state state--empty" role="status">
      <Icon name="inbox" size={28} />
      <div>
        <p className="state__title">{title}</p>
        {children && <p className="state__body">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 16, className = '' }: { width?: string | number; height?: number; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}
