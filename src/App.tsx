import { useState } from 'react';
import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { BalanceSummary } from './features/balance/BalanceSummary';
import { MockControls } from './features/dev-panel/MockControls';
import { SendMoney } from './features/send-money/SendMoney';
import { TransactionFeed } from './features/transactions/TransactionFeed';
import { useTheme } from './hooks/useTheme';

export function App() {
  const { theme, toggle } = useTheme();
  const [mockOpen, setMockOpen] = useState(false);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Header theme={theme} onToggleTheme={toggle} mockOpen={mockOpen} onToggleMock={() => setMockOpen((o) => !o)} />
      <OfflineBanner />
      {mockOpen && (
        <div className="container">
          <MockControls onClose={() => setMockOpen(false)} />
        </div>
      )}
      <main id="main" className="container layout">
        <h1 className="visually-hidden">NovaBiz merchant dashboard</h1>
        <div className="layout__summary">
          <BalanceSummary />
        </div>
        <div className="layout__aside">
          <SendMoney />
        </div>
        <div className="layout__feed">
          <TransactionFeed />
        </div>
      </main>
      <footer className="app-footer container">
        <p>
          NovaBiz is a fictional FirstBank NovaPay module built for evaluation. Transfers settle over NIBSS NIP. Personal data is
          processed in line with the Nigeria Data Protection Act 2023 — account numbers are masked.
        </p>
      </footer>
    </>
  );
}
