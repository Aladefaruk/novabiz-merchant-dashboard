import type { Decorator, Loader, Preview } from '@storybook/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { RequestHandler } from 'msw';
import { setupWorker } from 'msw/browser';
import { useEffect, useState } from 'react';
import { setMockConfig, type MockConfig } from '../src/mocks/config';
import { handlers } from '../src/mocks/handlers';
import { createQueryClient } from '../src/app/queryClient';
import '../src/app/index.css';

/**
 * Stories run against the app's own mock API. A story can put handlers in
 * `parameters.msw` to override one endpoint (e.g. a 503 or an endless request),
 * or `parameters.mockConfig` to change the chaos settings (failure rate, lost responses).
 */
const worker = setupWorker(...handlers);
let started: Promise<unknown> | undefined;

const mswLoader: Loader = async ({ parameters }) => {
  started ??= worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  await started;
  setMockConfig(
    { minLatencyMs: 300, maxLatencyMs: 300, failureRate: 0, lostResponseRate: 0, liveInflows: false, ...(parameters.mockConfig as Partial<MockConfig>) },
    { persist: false },
  );
  // resetHandlers(...x) would REPLACE the base handlers; reset, then layer the story's overrides on top.
  worker.resetHandlers();
  worker.use(...((parameters.msw as RequestHandler[] | undefined) ?? []));
};

/** A fresh cache per story (no retries, so error stories settle immediately). `parameters.seed` can pre-fill it. */
const withQueryClient: Decorator = (Story, { parameters }) => {
  const [client] = useState(() => {
    const qc = createQueryClient({ test: true });
    (parameters.seed as ((qc: ReturnType<typeof createQueryClient>) => void) | undefined)?.(qc);
    return qc;
  });
  return (
    <QueryClientProvider client={client}>
      <Story />
    </QueryClientProvider>
  );
};

/** Same data-theme switch the app's useTheme hook uses. */
const withTheme: Decorator = (Story, { globals }) => {
  const theme = globals.theme === 'dark' ? 'dark' : 'light';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <div className="bg-slate-100 p-4 text-slate-900 dark:bg-navy-950 dark:text-slate-100">
      <Story />
    </div>
  );
};

const preview: Preview = {
  loaders: [mswLoader],
  decorators: [withQueryClient, withTheme],
  globalTypes: {
    theme: {
      description: 'Colour theme',
      toolbar: { title: 'Theme', icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    viewport: {
      viewports: {
        android360: { name: 'Low-end Android (360px)', styles: { width: '360px', height: '740px' } },
        desktop1440: { name: 'Desktop (1440px)', styles: { width: '1440px', height: '900px' } },
      },
    },
    // Fail loudly in the a11y panel on WCAG 2.1 AA, which is what the brief asks for.
    a11y: { options: { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } },
  },
};

export default preview;
