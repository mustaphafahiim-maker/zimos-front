import { useState } from "react";
import { Button } from "@store-builder/ui";
import { digitalDeliverOrder, digitalOrderGrants, digitalUpdateGrant, type DigitalGrant, type DigitalGrantState } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { formatDateTime } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Digital delivery",
    description: "What this order's digital products gave the customer.",
    deliverNow: "Deliver now",
    delivered: "Delivered.",
    nothingToDeliver: "Nothing new to deliver: set up the product's delivery first.",
    state_active: "Active",
    state_expired: "Expired",
    state_used_up: "Download limit reached",
    state_revoked: "Revoked",
    type_file: "File",
    type_link: "Link",
    type_license_codes: "Licence codes",
    downloads: "{count} downloads",
    downloadsOf: "{count} of {max} downloads",
    expires: "Until {date}",
    codesMissing: "{count} codes still owed — add codes to the product's stock.",
    copyLink: "Copy customer link",
    renew: "Renew",
    revoke: "Revoke",
  },
  ar: {
    title: "التسليم الرقمي",
    description: "ما حصل عليه العميل من المنتجات الرقمية في هذا الطلب.",
    deliverNow: "سلّم الآن",
    delivered: "تم التسليم.",
    nothingToDeliver: "مفيش جديد للتسليم: جهّز تسليم المنتج أولًا.",
    state_active: "فعّال",
    state_expired: "منتهي",
    state_used_up: "وصل لحد التحميل",
    state_revoked: "ملغي",
    type_file: "ملف",
    type_link: "رابط",
    type_license_codes: "أكواد ترخيص",
    downloads: "{count} مرة تحميل",
    downloadsOf: "{count} من {max} مرة تحميل",
    expires: "حتى {date}",
    codesMissing: "باقي {count} كود لم يُسلَّم — أضف أكوادًا لمخزون المنتج.",
    copyLink: "نسخ رابط العميل",
    renew: "تجديد",
    revoke: "إلغاء",
  },
} satisfies Messages;

const TONE: Record<DigitalGrantState, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  expired: "warning",
  used_up: "warning",
  revoked: "danger",
};

/**
 * The order page's digital delivery card. Shows nothing for an order with no
 * digital grant unless it is paid, when "Deliver now" covers a product whose
 * delivery was set up after the sale.
 */
export function OrderDigitalSection({ orderId, paid }: { orderId: string; paid: boolean }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => digitalOrderGrants(apiClient, workspaceId, orderId), [workspaceId, orderId]);
  const [busy, setBusy] = useState(false);
  const grants = list.data?.grants ?? [];
  const pending = list.data?.pending ?? 0;

  if (!list.data || (grants.length === 0 && pending === 0)) return null;

  async function deliver() {
    setBusy(true);
    try {
      const next = await digitalDeliverOrder(apiClient, workspaceId, orderId);
      toast.success(next.grants.length > grants.length ? t.delivered : t.nothingToDeliver);
      list.setData(next);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function act(grant: DigitalGrant, action: "renew" | "revoke") {
    try {
      const saved = await digitalUpdateGrant(apiClient, workspaceId, grant.id, action);
      list.setData((prev) => ({ pending: prev?.pending ?? 0, grants: (prev?.grants ?? []).map((g) => (g.id === saved.id ? saved : g)) }));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const link = (grant: DigitalGrant) => `${STOREFRONT_URL}/store/${workspaceId}/downloads/${grant.token}`;

  return (
    <Section
      title={t.title}
      description={t.description}
      actions={
        paid && pending > 0 ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void deliver()}>
            {t.deliverNow}
          </Button>
        ) : undefined
      }
    >
      <ul className="divide-y divide-line">
        {grants.map((grant) => (
          <li key={grant.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  <bdi>{grant.productName}</bdi>
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {t[`type_${grant.type}`]}
                  {grant.fileName && (
                    <>
                      {" · "}
                      <bdi>{grant.fileName}</bdi>
                    </>
                  )}
                  {grant.type === "file" && (
                    <>
                      {" · "}
                      {grant.maxDownloads !== null
                        ? fmt(t.downloadsOf, { count: grant.downloadCount, max: grant.maxDownloads })
                        : fmt(t.downloads, { count: grant.downloadCount })}
                    </>
                  )}
                  {grant.expiresAt && <> · {fmt(t.expires, { date: formatDateTime(grant.expiresAt) })}</>}
                </p>
              </div>
              <StatusBadge value={grant.state} tone={TONE[grant.state]} text={t[`state_${grant.state}`]} />
            </div>
            {grant.codes.length > 0 && (
              <p dir="ltr" className="mt-2 flex flex-wrap gap-1.5 text-start">
                {grant.codes.map((code) => (
                  <code key={code} className="rounded border border-line bg-paper px-1.5 py-0.5 text-xs text-ink">
                    {code}
                  </code>
                ))}
              </p>
            )}
            {grant.codesMissing > 0 && <p className="mt-2 text-xs text-danger">{fmt(t.codesMissing, { count: grant.codesMissing })}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <CopyButton value={link(grant)} label={t.copyLink} />
              <Button size="sm" variant="outline" onClick={() => void act(grant, "renew")}>
                {t.renew}
              </Button>
              {grant.state !== "revoked" && (
                <Button size="sm" variant="outline" onClick={() => void act(grant, "revoke")}>
                  {t.revoke}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
