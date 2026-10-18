/**
 * Runtime-tunable chaos settings for the mock API. Editable from the in-app
 * "Mock API" panel, persisted to localStorage, and overridable via URL for
 * deterministic E2E runs, e.g. `/?mock.fail=1&mock.latency=0`.
 */
export interface MockConfig {
  /** Simulated network latency range in ms. */
  minLatencyMs: number;
  maxLatencyMs: number;
  /** 0–1 probability any request fails with 503 BEFORE the server does any work. */
  failureRate: number;
  /** 0–1 probability a transfer is COMMITTED but the response is lost (the nasty case). */
  lostResponseRate: number;
  /** Simulate customers paying the merchant in real time. */
  liveInflows: boolean;
}

export const DEFAULT_MOCK_CONFIG: MockConfig = {
  minLatencyMs: 250,
  maxLatencyMs: 900,
  failureRate: 0,
  lostResponseRate: 0,
  liveInflows: true,
};

const STORAGE_KEY = 'novabiz:mock-config';
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

let config: MockConfig = { ...DEFAULT_MOCK_CONFIG };
const listeners = new Set<() => void>();

function readUrlOverrides(): Partial<MockConfig> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out: Partial<MockConfig> = {};
  const num = (k: string) => (params.has(k) ? Number(params.get(k)) : undefined);
  const fail = num('mock.fail');
  const lost = num('mock.lost');
  const latency = num('mock.latency');
  if (fail !== undefined && !Number.isNaN(fail)) out.failureRate = clamp01(fail);
  if (lost !== undefined && !Number.isNaN(lost)) out.lostResponseRate = clamp01(lost);
  if (latency !== undefined && !Number.isNaN(latency)) {
    out.minLatencyMs = latency;
    out.maxLatencyMs = latency;
  }
  if (params.get('mock.live') === '0') out.liveInflows = false;
  return out;
}

export function initMockConfig(): void {
  let stored: Partial<MockConfig> = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<MockConfig>;
  } catch {
    /* storage unavailable (private mode) — use defaults */
  }
  config = { ...DEFAULT_MOCK_CONFIG, ...stored, ...readUrlOverrides() };
  emit();
}

export function getMockConfig(): MockConfig {
  return config;
}

export function setMockConfig(patch: Partial<MockConfig>, { persist = true } = {}): void {
  config = { ...config, ...patch };
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* ignore */
    }
  }
  emit();
}

export function subscribeMockConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((l) => l());
}
