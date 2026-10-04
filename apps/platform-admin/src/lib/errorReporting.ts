import { installErrorReporting } from "@store-builder/error-reporter";

/**
 * Unexpected errors to Sentry when VITE_SENTRY_DSN is set at build time
 * (packages/error-reporter); with none, nothing leaves the browser.
 */
export const errorReporter = installErrorReporting({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  app: "platform-admin",
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
  release: import.meta.env.VITE_RELEASE,
});
