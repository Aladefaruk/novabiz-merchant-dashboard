import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  // Serves public/mockServiceWorker.js so stories can use the same MSW mock API as the app.
  staticDirs: ['../public'],
};

export default config;
