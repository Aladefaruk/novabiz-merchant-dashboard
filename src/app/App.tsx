import { useState } from 'react';
import { Header } from '../shared/components/Header';
import { OfflineBanner } from '../shared/components/OfflineBanner';
import { BalanceSummary } from '../features/balance/BalanceSummary';
import { MockControls } from '../features/dev-panel/MockControls';
import { SendMoney } from '../features/send-money/SendMoney';
import { TransactionFeed } from '../features/transactions/TransactionFeed';
import { useTheme } from '../shared/hooks/useTheme';

export function App() {
  const { theme, toggle } = useTheme();
  const [mockOpen, setMockOpen] = useState(false);

  return (
    <>
      <a href="#main" className="sr-only rounded-lg bg-gold-500 px-4 py-2 font-bold text-navy-950 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50">
        Skip to main content
      </a>
      <Header theme={theme} onToggleTheme={toggle} mockOpen={mockOpen} onToggleMock={() => setMockOpen((o) => !o)} />
      <OfflineBanner />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {mockOpen && <MockControls onClose={() => setMockOpen(false)} />}

        {/* Mobile: balance → send → feed. Desktop (lg): send money is a sticky right column. */}
        <main id="main" className="grid gap-4 py-4 sm:gap-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[auto_1fr]">
          <h1 className="sr-only">NovaBiz merchant dashboard</h1>
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <BalanceSummary />
          </div>
          <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="lg:sticky lg:top-24">
              <SendMoney />
            </div>
          </aside>
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <TransactionFeed />
          </div>
        </main>
      </div>
    </>
  );
}
