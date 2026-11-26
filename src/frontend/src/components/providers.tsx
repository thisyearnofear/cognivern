"use client";

import { useSyncExternalStore } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { ThemeProvider, useTheme } from "next-themes";
import { MotionConfig } from "motion/react";
import { Toaster } from "@/components/ui/sonner";
import { AuthWatcher } from "@/components/auth-watcher";
import { AuthBridge } from "@/components/auth-bridge";
import { NotificationsProvider } from "@/components/layout/notifications-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { config } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

/**
 * Picks the RainbowKit theme from next-themes' resolved theme so the wallet
 * chrome matches the app in both light and dark mode. Defaults to light
 * before mount to avoid a hydration mismatch.
 */
function ThemedRainbowKitProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  // Hydration-safe mounted gate: false during SSR and first client render,
  // true afterwards — without setState-in-effect cascading renders.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isDark = mounted && resolvedTheme === "dark";
  const theme = isDark
    ? darkTheme({ accentColor: "#38bdf8" })
    : lightTheme({ accentColor: "#0284c7" });

  return <RainbowKitProvider theme={theme}>{children}</RainbowKitProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ThemedRainbowKitProvider>
            <MotionConfig reducedMotion="user">
              <AuthBridge />
              <AuthWatcher />
              <NotificationsProvider />
              <ErrorBoundary>{children}</ErrorBoundary>
              <Toaster />
            </MotionConfig>
          </ThemedRainbowKitProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
