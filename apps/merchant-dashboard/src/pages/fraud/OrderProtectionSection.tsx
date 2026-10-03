import { useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@store-builder/ui";
import { protectionAddBlocked, type Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Where this order came from",
    ip: "IP address",
    country: "Country",
    browser: "Browser",
    unknown: "Unknown",
    blockIp: "Block IP",
    blockTitle: "Block {ip}?",
    blockDescription: "Orders from this address will be flagged as blocked (or refused, if your rules say so), and it will no longer see your store.",
    blocking: "Blocking…",
    cancel: "Cancel",
    blocked: "{ip} is now blocked.",
    blockReason: "Blocked from order {number}",
  },
  ar: {
    title: "من أين جاء هذا الأوردر",
    ip: "عنوان IP",
    country: "الدولة",
    browser: "المتصفح",
    unknown: "غير معروف",
    blockIp: "حظر الـ IP",
    blockTitle: "حظر {ip}؟",
    blockDescription: "الأوردرات من هذا العنوان ستُميَّز كمحظورة (أو تُرفض إذا كانت قواعدك تقول ذلك)، ولن يرى متجرك بعد الآن.",
    blocking: "جارٍ الحظر…",
    cancel: "إلغاء",
    blocked: "تم حظر {ip}.",
    blockReason: "حُظر من الأوردر {number}",
  },
} satisfies Messages;

/** What the protection layer recorded on an order; not in the shared Order type yet. */
interface OrderVisitorFields {
  ipAddress?: string | null;
  ipCountry?: string | null;
  userAgent?: string | null;
}

function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Order page → the shopper's IP, country and browser, with "Block IP".
 * Renders nothing for an order with no recorded IP (staff orders, older ones).
 */
export function OrderProtectionSection({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [confirming, setConfirming] = useState(false);
  const visitor = order as Order & OrderVisitorFields;
  const ip: string = visitor.ipAddress ?? "";
  if (!ip) return null;
  const locale = typeof document !== "undefined" && document.documentElement.lang ? document.documentElement.lang : "en";

  async function block() {
    try {
      await protectionAddBlocked(apiClient, workspaceId, {
        type: "ip",
        value: ip,
        scopes: ["orders", "visit"],
        reason: fmt(t.blockReason, { number: order.orderNumber }),
      });
    } catch (err) {
      // ConfirmDialog shows a thrown Error's message as-is.
      throw new Error(errorMessage(err));
    }
    toast.success(fmt(t.blocked, { ip }));
    setConfirming(false);
  }

  return (
    <Section
      title={t.title}
      actions={
        <Button variant="outline" size="sm" className="min-h-9" onClick={() => setConfirming(true)}>
          <Ban className="size-4" aria-hidden />
          {t.blockIp}
        </Button>
      }
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-soft">{t.ip}</dt>
          <dd className="font-medium text-ink">
            <bdi dir="ltr">{ip}</bdi>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">{t.country}</dt>
          <dd className="font-medium text-ink">{visitor.ipCountry ? countryName(visitor.ipCountry, locale) : t.unknown}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-ink-soft">{t.browser}</dt>
          <dd className="truncate text-ink" dir="ltr" title={visitor.userAgent ?? undefined}>
            {visitor.userAgent || t.unknown}
          </dd>
        </div>
      </dl>
      <ConfirmDialog
        open={confirming}
        title={fmt(t.blockTitle, { ip })}
        description={t.blockDescription}
        confirmLabel={t.blockIp}
        busyLabel={t.blocking}
        cancelLabel={t.cancel}
        onCancel={() => setConfirming(false)}
        onConfirm={block}
      />
    </Section>
  );
}
