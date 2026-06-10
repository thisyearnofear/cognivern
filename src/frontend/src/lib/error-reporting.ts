/**
 * Error reporting interface.
 *
 * Provides a centralized place to report errors. Currently logs to console
 * in development. To enable Sentry:
 *
 * 1. `pnpm add @sentry/browser`
 * 2. Set `NEXT_PUBLIC_SENTRY_DSN` in your environment
 * 3. Add the Sentry import and init call inside `reportError()` below
 *
 * This separation means the app compiles and runs without Sentry installed.
 */

type ErrorContext = Record<string, unknown>;

/**
 * Report an error.
 *
 * Currently logs to console in development. When Sentry is configured,
 * add the init + captureException calls here.
 */
export function reportError(error: Error | string, context?: ErrorContext): void {
  const errorObj = typeof error === "string" ? new Error(error) : error;

  // To enable Sentry, uncomment:
  // import * as Sentry from "@sentry/browser";
  // Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN! });
  // Sentry.captureException(errorObj, { extra: context });

  if (process.env.NODE_ENV !== "production") {
    console.error("[error-reporting]", errorObj, context);
  }
}

/**
 * Set user context for error tracking.
 * No-op until Sentry is wired in.
 */
export function setErrorUserContext(_userId: string, _traits?: ErrorContext): void {
  // Sentry.setUser({ id: userId, ...traits });
}
