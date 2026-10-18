import { Icon } from './Icon';
import type { Theme } from '../hooks/useTheme';

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
  mockOpen: boolean;
  onToggleMock: () => void;
}

export function Header({ theme, onToggleTheme, mockOpen, onToggleMock }: Props) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <Icon name="qr" size={20} />
          </span>
          <span className="brand__text">
            <span className="brand__name">
              NovaBiz<span className="brand__by"> by FirstBank</span>
            </span>
            <span className="brand__merchant">Mama Titi’s Kitchen · Yaba</span>
          </span>
        </div>

        <div className="app-header__actions">
          <span className="kyc-badge" title="KYC Tier 3 — BVN & NIN verified">
            Tier 3
          </span>
          <button
            type="button"
            className="btn btn--header btn--sm"
            onClick={onToggleMock}
            aria-expanded={mockOpen}
            aria-controls="mock-panel"
            aria-label="Mock API controls"
          >
            <Icon name="sliders" size={16} />
            <span className="hide-sm" aria-hidden="true">
              Mock API
            </span>
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--on-brand"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
