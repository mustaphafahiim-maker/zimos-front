import type { Instrumentation } from "next";
import { createErrorReporter } from "@store-builder/error-reporter";

/**
 * The storefront server's errors (server components, route handlers, the
 * proxy) to Sentry when SENTRY_DSN — or NEXT_PUBLIC_SENTRY_DSN — is set
 * (packages/error-reporter). Without one, Next's own log line is the report.
 */
const reporter = createErrorReporter({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  app: "storefront-server",
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_RELEASE,
});

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // A locked store's pages are refused under its gate page on purpose (components/gate, handoff 197).
  if ((error as { code?: unknown } | null)?.code === "STORE_LOCKED") return;
  await reporter.report(error, {
    url: request.path,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
    renderSource: "renderSource" in context ? context.renderSource : undefined,
    runtime: process.env.NEXT_RUNTIME,
  });
};
