import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initMockConfig } from './mocks/config';
import { createQueryClient } from './queryClient';
import './styles/global.css';

async function bootstrap() {
  // No real backend exists: the mock API is part of the product for this exercise, so it runs in every build.
  initMockConfig();
  const { worker, startLiveInflows } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  startLiveInflows();

  const queryClient = createQueryClient();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
