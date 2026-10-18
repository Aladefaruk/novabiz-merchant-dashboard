import type { ApiErrorBody } from './types';

/**
 * Error kinds matter for money movement:
 *  - 'http' 4xx  -> definite rejection. Server did NOT move money. Never auto-retry.
 *  - 'http' 5xx  -> server-side failure. Outcome may be unknown; safe to retry ONLY with the same idempotency key.
 *  - 'timeout' / 'network' -> AMBIGUOUS. The request may have been committed and only the response lost.
 */
export type ApiErrorKind = 'http' | 'timeout' | 'network' | 'aborted';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;

  constructor(kind: ApiErrorKind, message: string, opts: { status?: number; code?: string } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = opts.status;
    this.code = opts.code;
  }

  /** True when we cannot know whether the server applied the request. */
  get isAmbiguous(): boolean {
    return this.kind === 'timeout' || this.kind === 'network' || (this.kind === 'http' && (this.status ?? 0) >= 500);
  }

  get isRetryable(): boolean {
    return this.isAmbiguous || this.status === 429;
  }
}

export const DEFAULT_TIMEOUT_MS = 10_000;

interface RequestOptions extends Omit<RequestInit, 'signal'> {
  timeoutMs?: number;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined>;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, query, headers, ...init } = options;

  const url = new URL(path, window.location.origin);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }

  // Our own controller so we can distinguish "we timed out" from "caller cancelled".
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut) throw new ApiError('timeout', 'The request timed out.');
    if (callerSignal?.aborted) throw new ApiError('aborted', 'The request was cancelled.');
    throw new ApiError('network', 'Network error — check your connection.', { code: (err as Error)?.name });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }

  if (!response.ok) {
    let body: Partial<ApiErrorBody> = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError('http', body.message ?? `Request failed (${response.status}).`, {
      status: response.status,
      code: body.code,
    });
  }

  return (await response.json()) as T;
}

/** Exponential backoff with full jitter, capped — kind to congested mobile networks. */
export function backoffDelay(attempt: number, baseMs = 800, capMs = 10_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.round(exp / 2 + Math.random() * (exp / 2));
}
