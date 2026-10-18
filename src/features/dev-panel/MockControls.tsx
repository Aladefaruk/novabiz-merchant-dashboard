import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { queryKeys } from '../../api/endpoints';
import { Icon } from '../../components/Icon';
import { DEFAULT_MOCK_CONFIG, getMockConfig, setMockConfig, subscribeMockConfig } from '../../mocks/config';
import { db } from '../../mocks/db';

const percentFormatter = new Intl.NumberFormat('en-NG', { style: 'percent' });

/**
 * Chaos controls for the mock API — so reviewers can *see* error, retry,
 * rollback and idempotency behaviour without editing code.
 */
export function MockControls({ onClose }: { onClose: () => void }) {
  const id = useId();
  const qc = useQueryClient();
  const config = useSyncExternalStore(subscribeMockConfig, getMockConfig, getMockConfig);
  // The mock ledger isn't a React store; re-read its counter while the panel is open.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const pct = (n: number) => percentFormatter.format(n);

  return (
    <section className="mock-panel" aria-labelledby={`${id}-title`} id="mock-panel">
      <div className="mock-panel__header">
        <h2 id={`${id}-title`}>
          <Icon name="sliders" size={18} /> Mock API controls
        </h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close mock API controls">
          <Icon name="close" size={18} />
        </button>
      </div>
      <p className="mock-panel__intro">
        There’s no real backend — requests are served by MSW in your browser. Tune the network to exercise loading, error
        and reconciliation paths.
      </p>

      <div className="mock-panel__grid">
        <div className="field field--compact">
          <label htmlFor={`${id}-latency`}>
            Latency <output htmlFor={`${id}-latency`}>{config.maxLatencyMs} ms</output>
          </label>
          <input
            id={`${id}-latency`}
            type="range"
            min={0}
            max={5000}
            step={100}
            value={config.maxLatencyMs}
            onChange={(e) => {
              const max = Number(e.target.value);
              setMockConfig({ maxLatencyMs: max, minLatencyMs: Math.round(max * 0.3) });
            }}
          />
        </div>

        <div className="field field--compact">
          <label htmlFor={`${id}-fail`}>
            Failure rate (503 before processing) <output htmlFor={`${id}-fail`}>{pct(config.failureRate)}</output>
          </label>
          <input
            id={`${id}-fail`}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.failureRate}
            onChange={(e) => setMockConfig({ failureRate: Number(e.target.value) })}
          />
        </div>

        <div className="field field--compact">
          <label htmlFor={`${id}-lost`}>
            Lost response (transfer commits, reply dropped) <output htmlFor={`${id}-lost`}>{pct(config.lostResponseRate)}</output>
          </label>
          <input
            id={`${id}-lost`}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.lostResponseRate}
            onChange={(e) => setMockConfig({ lostResponseRate: Number(e.target.value) })}
          />
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={config.liveInflows} onChange={(e) => setMockConfig({ liveInflows: e.target.checked })} />
          Simulate live customer payments
        </label>
      </div>

      <div className="mock-panel__actions">
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => {
            db.receivePayment();
            void qc.invalidateQueries({ queryKey: queryKeys.balance });
          }}
        >
          Receive a payment now
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setMockConfig(DEFAULT_MOCK_CONFIG)}>
          Reset network settings
        </button>
        <span className="mock-panel__stat">
          Server committed <strong data-testid="committed-count">{db.committedTransfers}</strong> transfer(s) this session
        </span>
      </div>
    </section>
  );
}
