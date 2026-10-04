import { installErrorReporting } from "@store-builder/error-reporter";

/**
 * Runs before the storefront becomes interactive: the shopper's uncaught
 * errors go to Sentry when NEXT_PUBLIC_SENTRY_DSN is set at build time
 * (packages/error-reporter). Only errors from the storefront's own bundles —
 * a merchant's custom code or an ad pixel failing is not a storefront bug.
 */
try {
  installErrorReporting({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    app: "storefront",
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_RELEASE,
    onlyStacksMatching: /\/_next\//,
  });
} catch {
  /* reporting never stops the store */
}
