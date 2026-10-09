import type { PaymentGatewayInfo } from "@store-builder/api-client";
import { IconCheck, IconWarning } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    events: "Turn on these events for the webhook",
    noSecret: "Without the signing secret, refunds and disputes from Stripe won't reach ZIMOS",
  },
  ar: {
    events: "فعّل الأحداث دي في الـ Webhook",
    noSecret: "من غير مفتاح التوقيع، الاسترجاعات والنزاعات اللي بتحصل في Stripe مش هتوصل",
  },
} satisfies Messages;

/** Handoff 377: the events to tick in the gateway's webhook (refunds and disputes made there reach the order through them). */
function eventsOf(gateway: PaymentGatewayInfo): string[] {
  const events = (gateway.webhookSetup as { events?: unknown }).events;
  return Array.isArray(events) ? events.filter((e): e is string => typeof e === "string") : [];
}

/** The checklist under a gateway's webhook URL. Nothing for a gateway that names no events. */
export function WebhookEvents({ gateway }: { gateway: PaymentGatewayInfo }) {
  const t = useT(STRINGS);
  const events = eventsOf(gateway);
  if (events.length === 0) return null;
  return (
    <div data-slot="webhook-events" className="flex flex-col gap-1.5">
      <p className="text-[13px] leading-5 font-medium text-ink">{t.events}</p>
      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {events.map((event) => (
          <li key={event} className="flex min-w-0 items-start gap-1.5 text-xs leading-5 text-ink-soft">
            <IconCheck className="mt-1 size-3 shrink-0 text-success" weight="bold" aria-hidden />
            <code dir="ltr" className="min-w-0 wrap-anywhere text-ink">
              {event}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Next to Stripe's empty signing secret in the connect form: without it no
 * webhook is trusted. Shown while nothing is typed and no signed callback has
 * ever arrived (a stored secret is never sent back, so that is the only sign).
 */
export function SigningSecretNote({ gateway, typed }: { gateway: PaymentGatewayInfo; typed: Record<string, string> }) {
  const t = useT(STRINGS);
  if (gateway.code !== "stripe") return null;
  if (!gateway.credentialFields.some((field) => field.key === "webhookSecret")) return null;
  if ((typed.webhookSecret ?? "").trim() !== "") return null;
  if (gateway.connection?.lastWebhookAt) return null;
  return (
    <p data-slot="signing-secret-note" role="note" className="flex items-start gap-1.5 text-[13px] leading-5 text-accent-dark">
      <IconWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
      {t.noSecret}
    </p>
  );
}
