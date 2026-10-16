import { useT, type Messages } from "@/i18n/LocaleContext";
import { IconWarning } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";

/**
 * Whether a customer email or SMS really arrived. Brevo and
 * Twilio report back; the order's timeline shows it as a chip on the message
 * and as a red line at the moment the provider said so, and the customer's
 * timeline shows the same red line.
 */
export const MESSAGE_DELIVERY_STRINGS = {
  en: {
    chip_sent: "Sent",
    chip_delivered: "Delivered",
    chip_read: "Read",
    chip_bounced: "Bounced",
    chip_complained: "Marked as spam",
    chip_undelivered: "Not delivered",
    chip_suppressed: "Not sent — address suppressed",
    chip_failed: "Failed",
    line_bounced: "Email bounced — the address doesn't work",
    line_sms: "SMS not delivered",
    line_complained: "The customer marked the email as spam",
    line_other: "A message to the customer did not arrive",
    reason: "Why",
  },
  ar: {
    chip_sent: "أُرسلت",
    chip_delivered: "وصلت",
    chip_read: "قُرئت",
    chip_bounced: "مرتدّة",
    chip_complained: "صُنّفت كرسالة مزعجة",
    chip_undelivered: "لم تصل",
    chip_suppressed: "لم تُرسل — العنوان موقوف",
    chip_failed: "فشل الإرسال",
    line_bounced: "ارتدّ بريد الطلب — العنوان غير صالح",
    line_sms: "رسالة SMS لم تصل",
    line_complained: "صنّف العميل البريد كرسالة مزعجة",
    line_other: "لم تصل رسالة إلى العميل",
    reason: "السبب",
  },
} satisfies Messages;

export type MessageDeliveryStrings = Record<keyof (typeof MESSAGE_DELIVERY_STRINGS)["en"], string>;

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const CHIP_TONE: Record<string, Tone> = {
  sent: "neutral",
  delivered: "success",
  read: "success",
  bounced: "danger",
  complained: "danger",
  undelivered: "danger",
  suppressed: "warning",
  failed: "danger",
};

/** True for the statuses that mean the customer did not get the message. */
export function isUndelivered(status: unknown): boolean {
  return status === "bounced" || status === "complained" || status === "undelivered" || status === "suppressed" || status === "failed";
}

/**
 * The small chip on a message row: «اتبعت», «وصل», «مرتدّ»… The provider's
 * reason, when there is one, is the chip's tooltip (and is read with it).
 */
export function MessageStatusChip({ status, reason }: { status: string; reason?: string | null }) {
  const t = useT(MESSAGE_DELIVERY_STRINGS) as MessageDeliveryStrings;
  const text = (t as Record<string, string | undefined>)[`chip_${status}`] ?? status;
  return (
    <span title={reason || undefined} className={reason ? "cursor-help" : undefined}>
      <StatusBadge value={status} tone={CHIP_TONE[status] ?? "neutral"} text={text} className="whitespace-normal text-start" />
      {reason && <span className="sr-only"> — {reason}</span>}
    </span>
  );
}

/** The sentence for a message the provider reported as not arrived, by channel and status. */
export function undeliveredText(t: MessageDeliveryStrings, channel: unknown, status: unknown): string {
  if (status === "complained") return t.line_complained;
  if (channel === "sms") return t.line_sms;
  if (channel === "email" && (status === "bounced" || status === "undelivered")) return t.line_bounced;
  return t.line_other;
}

/**
 * The red line of a `message_status` event (order timeline) or a
 * `message_undelivered` one (customer timeline): what happened, in words and
 * with a warning glyph — never the colour alone — and the provider's reason
 * as its tooltip.
 */
export function UndeliveredLine({ channel, status, reason, className }: { channel: unknown; status: unknown; reason?: unknown; className?: string }) {
  const t = useT(MESSAGE_DELIVERY_STRINGS) as MessageDeliveryStrings;
  const why = typeof reason === "string" && reason.trim() ? reason.trim() : null;
  return (
    <span title={why ?? undefined} className={`inline-flex items-start gap-1.5 font-medium text-danger ${why ? "cursor-help" : ""} ${className ?? ""}`}>
      <IconWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {undeliveredText(t, channel, status)}
        {why && (
          <span className="sr-only">
            {" "}
            — {t.reason}: {why}
          </span>
        )}
      </span>
    </span>
  );
}
