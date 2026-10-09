import { useState } from "react";
import { IconWhatsApp } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { ordersWhatsappConfirm, ordersWhatsappFallbackLink, type Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { useOrderErrorMessage } from "../orderErrors";

const STRINGS = {
  en: {
    confirm: "Confirm via WhatsApp",
    sending: "Sending…",
    sent: "Confirmation sent on WhatsApp. The customer's tap confirms or cancels the order.",
    opened: "WhatsApp opened with the message ready. Send it from your phone.",
    openAgain: "Open WhatsApp",
  },
  ar: {
    confirm: "تأكيد عبر واتساب",
    sending: "بنبعت…",
    sent: "أُرسلت رسالة التأكيد على واتساب. ضغط العميل يؤكد الطلب أو يلغيه.",
    opened: "فُتح واتساب والرسالة جاهزة. أرسلها من هاتفك.",
    openAgain: "فتح واتساب",
  },
} satisfies Messages;

/**
 * The order page's "Confirm via WhatsApp" (SPEC §4.4): the store's
 * confirmation template when WhatsApp is connected, otherwise wa.me with the
 * message written out. Shown while the order still waits for confirmation.
 */
export function WhatsappConfirmButton({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  if (order.cancelledAt || order.confirmationState === "confirmed" || order.confirmationState === "rejected") return null;

  async function send() {
    setBusy(true);
    setLink(null);
    try {
      const result = await ordersWhatsappConfirm(apiClient, workspaceId, order.id);
      if (result.channel === "whatsapp") {
        toast.success(t.sent);
        onChanged();
      } else {
        setLink(result.link);
        window.open(result.link, "_blank", "noopener");
        toast.success(t.opened);
      }
    } catch (err) {
      toast.error(errorMessage(err));
      setLink(ordersWhatsappFallbackLink(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="min-h-11 gap-1.5" onClick={send} disabled={busy}>
        <IconWhatsApp className="size-4" aria-hidden />
        {busy ? t.sending : t.confirm}
      </Button>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
        >
          {t.openAgain}
        </a>
      )}
    </>
  );
}
