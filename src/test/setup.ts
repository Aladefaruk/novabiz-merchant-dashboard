import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { transferRetryConfig } from '../hooks/useTransfer';
import { DEFAULT_MOCK_CONFIG, setMockConfig } from '../mocks/config';
import { db } from '../mocks/db';
import { server } from '../mocks/server';

// jsdom gaps
window.scrollTo = (() => {}) as typeof window.scrollTo;
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  // Deterministic, instant mock network for component tests.
  setMockConfig({ ...DEFAULT_MOCK_CONFIG, minLatencyMs: 0, maxLatencyMs: 0, liveInflows: false }, { persist: false });
  db.reset();
  transferRetryConfig.delay = () => 0;
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
  localStorage.clear();
});

afterAll(() => server.close());
