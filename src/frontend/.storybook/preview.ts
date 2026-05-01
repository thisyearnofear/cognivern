import type { Preview } from '@storybook/react';
import React from 'react';
import { Global, ThemeProvider } from '@emotion/react';
import { designSystem } from '../src/styles/design-system';

const globalStyles = (
  <Global
    styles={`
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        font-family: ${designSystem.typography.fontFamily};
        background-color: ${designSystem.colors.neutral[50]};
        -webkit-font-smoothing: antialiased;
      }
    `}
  />
);

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f8fafc' },
        { name: 'dark', value: '#0f172a' },
      ],
    },
    a11y: {
      config: {
        rules: [{ id: 'color-contrast', enabled: true }],
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={designSystem}>
        {globalStyles}
        <div style={{ padding: '24px', maxWidth: '600px' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default preview;
