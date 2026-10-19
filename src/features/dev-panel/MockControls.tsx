import { useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { queryKeys } from '../../shared/api/endpoints';
import { btnGhost, btnSecondary } from '../../shared/components/ui';
import { DEFAULT_MOCK_CONFIG, getMockConfig, setMockConfig, subscribeMockConfig } from '../../mocks/config';
import { db } from '../../mocks/db';

const percent = new Intl.NumberFormat('en-NG', { style: 'percent' });

/** Lets a reviewer break the (fake) network on purpose to see the error / retry / rollback paths. */
export function MockControls({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const config = useSyncExternalStore(subscribeMockConfig, getMockConfig);

  // The mock database isn't React state, so re-read its counter once a second while the panel is open.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const slider = (id: string, text: string, value: number, display: string, max: number, step: number, onChange: (v: number) => void) => (
    <div>
      <label htmlFor={id} className="mb-1 flex justify-between gap-2 text-sm font-semibold">
        {text} <output htmlFor={id}>{display}</output>
      </label>
      <input id={id} type="range" min={0} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-gold-500" />
    </div>
  );

  return (
    <section id="mock-panel" aria-labelledby="mock-title" className="mt-4 rounded-2xl border-2 border-dashed border-gold-500 bg-white p-4 dark:bg-navy-900">
      <div className="flex items-center justify-between">
        <h2 id="mock-title" className="flex items-center gap-2 font-bold">
          <SlidersHorizontal aria-hidden className="size-4" /> Mock API controls
        </h2>
        <button type="button" className={btnGhost} onClick={onClose} aria-label="Close mock API controls">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">No real backend: requests are answered by MSW in your browser.</p>

      <div className="grid gap-4 lg:grid-cols-3">
        {slider('mock-latency', 'Latency', config.maxLatencyMs, `${config.maxLatencyMs} ms`, 5000, 100, (v) => setMockConfig({ maxLatencyMs: v, minLatencyMs: Math.round(v * 0.3) }))}
        {slider('mock-fail', 'Failure rate', config.failureRate, percent.format(config.failureRate), 1, 0.05, (v) => setMockConfig({ failureRate: v }))}
        {slider('mock-lost', 'Lost response (committed, reply dropped)', config.lostResponseRate, percent.format(config.lostResponseRate), 1, 0.05, (v) => setMockConfig({ lostResponseRate: v }))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            db.receivePayment();
            void qc.invalidateQueries({ queryKey: queryKeys.balance });
          }}
        >
          Receive a payment now
        </button>
        <button type="button" className={btnGhost} onClick={() => setMockConfig(DEFAULT_MOCK_CONFIG)}>Reset</button>
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Server committed <strong data-testid="committed-count">{db.committedTransfers}</strong> transfer(s)
        </span>
      </div>
    </section>
  );
}
