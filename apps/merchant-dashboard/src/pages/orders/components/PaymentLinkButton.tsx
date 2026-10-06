import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@store-builder/ui";
import { paymentRulesCreateLink } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { storeUrl } from "@/lib/storeAddress";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Modal } from "@/components/Modal";
import { CopyButton } from "@/components/CopyButton";
import { useToast } from "@/components/Toast";
import { formatDateTime } from "@/lib/format";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    button: "Payment link",
    working: "Creating…",
    title: "Payment link for the customer",
    description: "Send this link to the customer to try the payment again. Any link sent before stops working.",
    expires: "Works until {date}.",
    close: "Close",
  },
  ar: {
    button: "رابط الدفع",
    working: "بنعمله…",
    title: "رابط الدفع للعميل",
    description: "أرسل هذا الرابط للعميل ليحاول الدفع مرة أخرى. أي رابط أُرسل من قبل يتوقف عن العمل.",
    expires: "يعمل حتى {date}.",
    close: "إغلاق",
  },
} satisfies Messages;

/**
 * "Try again" link for an unpaid card or wallet order (SPEC §11.4): a fresh
 * link the merchant copies and sends to the customer.
 */
export function PaymentLinkButton({ workspaceId, orderId }: { workspaceId: string; orderId: string }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const { currentWorkspace } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);

  async function create() {
    setBusy(true);
    try {
      const created = await paymentRulesCreateLink(apiClient, workspaceId, orderId);
      const base = currentWorkspace?.slug ? storeUrl(currentWorkspace.slug).replace(/\/+$/, "") : "";
      setLink({ url: `${base}${created.path}`, expiresAt: created.expiresAt });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => void create()}>
        <Link2 className="size-4" aria-hidden />
        {busy ? t.working : t.button}
      </Button>
      <Modal
        open={link !== null}
        onClose={() => setLink(null)}
        title={t.title}
        description={t.description}
        footer={
          <Button variant="outline" onClick={() => setLink(null)}>
            {t.close ?? common.cancel}
          </Button>
        }
      >
        {link && (
          <div className="space-y-3">
            <code dir="ltr" className="block overflow-x-auto rounded-lg bg-paper px-3 py-2 text-start text-xs text-ink">
              {link.url}
            </code>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-ink-soft">{fmt(t.expires, { date: formatDateTime(link.expiresAt) })}</span>
              <CopyButton value={link.url} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
