import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createQueryClient } from '../queryClient';
import { server } from '../mocks/server';

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  const queryClient = createQueryClient({ test: true });
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>, options) };
}

/** Records every request the app makes, for asserting on headers/bodies. */
export function captureRequests(pathFragment: string) {
  const captured: { method: string; url: string; headers: Headers; body?: unknown }[] = [];
  server.events.on('request:start', async ({ request }) => {
    if (!request.url.includes(pathFragment)) return;
    const body = request.method === 'POST' ? await request.clone().json() : undefined;
    captured.push({ method: request.method, url: request.url, headers: request.headers, body });
  });
  return captured;
}

/** A promise you resolve by hand — lets a test hold a request "in flight". */
export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}
