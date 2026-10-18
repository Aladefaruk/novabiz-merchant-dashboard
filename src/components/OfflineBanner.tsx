import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Icon } from './Icon';

export function OfflineBanner() {
  const online = useOnlineStatus();
  return (
    <div role="status" aria-live="polite">
      {!online && (
        <div className="offline-banner">
          <Icon name="wifiOff" size={18} />
          <span>
            You’re offline. Showing your last loaded data — we’ll reconnect automatically. Urgent? Dial <strong>*894#</strong>.
          </span>
        </div>
      )}
    </div>
  );
}
