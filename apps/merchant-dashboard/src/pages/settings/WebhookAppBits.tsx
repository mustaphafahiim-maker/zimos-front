import { Alert } from "@store-builder/ui";
import { webhookAppRemoved, webhookCreatedByApp } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";

/**
 * Settings → Developers → Webhooks (frontend-handoff 266): an endpoint an app
 * made through the public API carries a «من تطبيق» chip. Once that app is
 * uninstalled (or its key revoked) the endpoint is off for good — it says why,
 * and the list hides its «تشغيل» button (`webhookAppRemoved`), since the
 * server would refuse it (409 WEBHOOK_APP_REMOVED).
 */

const STRINGS = {
  en: {
    fromApp: "From an app",
    removed: "Off because the app was removed. It can't be turned back on.",
  },
  ar: {
    fromApp: "من تطبيق",
    removed: "اتقفل لأن التطبيق اتشال، ومينفعش يتشغّل تاني.",
  },
} satisfies Messages;

export { webhookAppRemoved };

/** «من تطبيق» beside the endpoint's address; nothing for one the merchant added. */
export function WebhookAppBadge({ endpoint }: { endpoint: object }) {
  const t = useT(STRINGS);
  if (!webhookCreatedByApp(endpoint)) return null;
  return <StatusBadge value="app" tone="info" text={t.fromApp} />;
}

/** Why an app's endpoint is off, in place of the "three days of failures" note. */
export function WebhookAppRemovedNote({ endpoint }: { endpoint: object }) {
  const t = useT(STRINGS);
  if (!webhookAppRemoved(endpoint)) return null;
  return <Alert>{t.removed}</Alert>;
}
