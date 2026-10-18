import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  return (
    <div role="status">
      {!online && (
        <p className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
          <WifiOff aria-hidden className="size-4 shrink-0" />
          You’re offline. Showing your last loaded data. Urgent? Dial *894#.
        </p>
      )}
    </div>
  );
}
