import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ThemeProvider } from './styles/theme';

// Suppress MetaMask SDK errors in production
// The SDK tries to override window.ethereum which causes errors in some environments
if (import.meta.env.PROD) {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    // Filter out MetaMask SDK property setter errors
    if (
      args[0]?.message?.includes('Cannot set property ethereum') ||
      args[0]?.toString().includes('pageProvider')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
