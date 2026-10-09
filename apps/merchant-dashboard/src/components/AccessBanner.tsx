import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router-dom";
import { IconBlock, IconClose, IconDraft, IconWarning } from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import type { WorkspaceAccess } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { formatDate, formatDateTime } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { getGoLiveState, openGoLive, subscribeGoLive } from "@/lib/goLive";
import { WalletBalanceBanner } from "@/pages/settings/billing/WalletBanner";

/**
 * The subscription / suspension banner shown above every dashboard page, from
 * GET /workspaces/:id/access (workspaces/workspaceAccessService):
 *
 *   expiring     "expires on {date}"          — dismissible for the day
 *   payment_due  "a payment is due"           — dismissible for the day
 *   grace        "expired; restricted {when}" — dismissible for the day
 *   restricted   "store unavailable"          — stays up
 *   suspended    "suspended by Zimos"         — stays up
 *   draft        "your store is a draft"      — stays up, with a Subscribe
 *                button (the subscribe dialog, lib/goLive)
 *
 * A dismissed banner comes back the next day while it still applies. Re-read
 * on every page change, so a payment clears it without a reload.
 *
 * One rounded banner for all six: a filled 20px icon in the tone's colour, the
 * sentence in plain ink, and what can be done about it as pills at the end —
 * under the sentence on a phone. Its tinted glass is in glass/states.css
 * (`[data-slot="access-banner"]`).
 */

const STRINGS = {
  en: {
    expiring: "Your subscription expires on {date}. Renew it to keep your store running.",
    expiringTrial: "Your free trial ends on {date}. Choose a plan to keep your store running.",
    paymentDue: "A payment for your subscription is due. Your current period ends on {date}.",
    grace:
      "Your subscription expired on {date}. If it isn't renewed, your store will be restricted on {when}: shoppers won't be able to see it, and you won't be able to add new products or funnels.",
    restricted:
      "Your subscription has expired, so your store is unavailable to shoppers and you can't add new products or funnels. Everything else keeps working. Renew to restore it.",
    notEnforced: "Your subscription has expired. Renew it to keep your store running.",
    suspended:
      "This store has been suspended by Zimos. It's unavailable to shoppers and new products and funnels can't be added. Contact Zimos support.",
    billingLink: "Plan and billing",
    dismiss: "Dismiss for today",
    draft: "Your store is in draft mode: build as much as you like, and subscribe to publish it.",
    subscribe: "Subscribe to publish your store",
  },
  ar: {
    expiring: "اشتراكك هيخلص يوم {date}. جدّده عشان متجرك يفضل شغّال.",
    expiringTrial: "الفترة التجريبية المجانية هتخلص يوم {date}. اختار باقة عشان متجرك يفضل شغّال.",
    paymentDue: "فيه دفعة مستحقة على اشتراكك. الفترة الحالية هتخلص يوم {date}.",
    grace:
      "اشتراكك خلص يوم {date}. لو ما اتجددش، متجرك هيتقيّد في {when}: العملاء مش هيشوفوه، ومش هتقدر تضيف منتجات أو مسارات بيع جديدة.",
    restricted:
      "اشتراكك خلص، فمتجرك مش ظاهر للعملاء ومش هتقدر تضيف منتجات أو مسارات بيع جديدة. كل حاجة تانية شغّالة زي ما هي. جدّد الاشتراك عشان يرجع.",
    notEnforced: "اشتراكك خلص. جدّده عشان متجرك يفضل شغّال.",
    suspended:
      "Zimos وقّفت المتجر ده. مش ظاهر للعملاء ومش هينفع تضيف منتجات أو مسارات بيع جديدة. كلّم دعم Zimos.",
    billingLink: "الباقة والفواتير",
    dismiss: "اخفيها النهارده",
    draft: "متجرك لسه مسودة: ابنيه براحتك، واشترك لما تحب تنشره.",
    subscribe: "اشترك وانشر متجرك",
  },
} satisfies Messages;

type Notice = { key: string; tone: "warning" | "danger" | "draft"; text: string; dismissible: boolean; billing: boolean };

/** Today in the viewer's time zone, as the dismissal stamp. */
function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function storageKey(workspaceId: string, notice: string) {
  return `zimos.accessBanner.${workspaceId}.${notice}`;
}

function isDismissedToday(workspaceId: string, notice: string): boolean {
  try {
    return localStorage.getItem(storageKey(workspaceId, notice)) === localDay();
  } catch {
    return false;
  }
}

function noticeFor(access: WorkspaceAccess, t: Record<keyof (typeof STRINGS)["en"], string>): Notice | null {
  if (access.suspension.suspended) {
    return { key: "suspended", tone: "danger", text: t.suspended, dismissible: false, billing: false };
  }
  if (access.draft) {
    return { key: "draft", tone: "draft", text: t.draft, dismissible: false, billing: false };
  }
  const b = access.billing;
  const date = b.periodEnd ? formatDate(b.periodEnd) : "";
  switch (b.phase) {
    case "expiring":
      return {
        key: "expiring",
        tone: "warning",
        text: fmt(b.trialing ? t.expiringTrial : t.expiring, { date }),
        dismissible: true,
        billing: true,
      };
    case "payment_due":
      return { key: "payment_due", tone: "warning", text: fmt(t.paymentDue, { date }), dismissible: true, billing: true };
    case "grace":
      return {
        key: "grace",
        tone: "danger",
        text: b.enforced
          ? fmt(t.grace, { date, when: b.restrictsAt ? formatDateTime(b.restrictsAt) : "" })
          : t.notEnforced,
        dismissible: true,
        billing: true,
      };
    case "restricted":
      return b.enforced
        ? { key: "restricted", tone: "danger", text: t.restricted, dismissible: false, billing: true }
        : { key: "restricted_warn", tone: "danger", text: t.notEnforced, dismissible: true, billing: true };
    default:
      return null;
  }
}

export function AccessBanner() {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const location = useLocation();
  // Re-read when a store goes live from the subscribe dialog, so the draft
  // banner goes away without a reload.
  const { liveVersion } = useSyncExternalStore(subscribeGoLive, getGoLiveState);
  const [access, setAccess] = useState<WorkspaceAccess | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    apiClient
      .getWorkspaceAccess(workspaceId)
      .then((a) => {
        if (!cancelled) setAccess(a);
      })
      .catch(() => {
        // A banner that can't load is simply not shown.
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, location.pathname, liveVersion]);

  if (!workspaceId || !access) return null;
  const notice = noticeFor(access, t);
  // The prepaid balance of a pay-per-order store has its own banner (handoff 335).
  const balance = <WalletBalanceBanner access={access} />;
  if (!notice) return balance;
  if (notice.dismissible && (dismissedKey === notice.key || isDismissedToday(workspaceId, notice.key))) return balance;

  const canSeeBilling = ["owner", "accountant"].includes(currentWorkspace?.role ?? "");

  const NoticeIcon = notice.key === "suspended" ? IconBlock : notice.key === "draft" ? IconDraft : IconWarning;
  const showBilling = notice.billing && canSeeBilling;
  const isDraft = notice.key === "draft";

  return (
    <>
    {balance}
    <div
      role={notice.tone === "danger" ? "alert" : "status"}
      data-testid="access-banner"
      data-slot="access-banner"
      data-tone={notice.tone}
      className={cn(
        "mb-4 flex flex-wrap items-start gap-x-2 gap-y-1 rounded-[1.25rem] border py-1.5 ps-4 pe-2 text-sm text-ink",
        notice.tone === "danger"
          ? "border-danger/30 bg-danger-soft"
          : notice.tone === "draft"
            ? "border-primary/30 bg-primary-soft"
            : "border-accent/30 bg-accent-soft"
      )}
    >
      {/* The icon, the pill and the close button are level with the first line of the
          sentence, however many lines it runs to: that line is as tall as a pill (36px,
          44px under a thumb). */}
      <NoticeIcon
        weight="fill"
        data-slot="access-banner-icon"
        className={cn(
          "me-1 mt-2 size-5 shrink-0 pointer-coarse:mt-3",
          notice.tone === "danger" ? "text-danger" : notice.tone === "draft" ? "text-primary" : "text-accent-dark"
        )}
        aria-hidden
      />
      {/* A narrow basis: on the smallest phones the close button must still fit beside the sentence. */}
      <p className="min-w-0 flex-1 basis-40 py-1.5 pe-2 leading-6 pointer-coarse:py-2.5">{notice.text}</p>
      {/* On a phone what can be done sits on its own line under the sentence (this empty
          item breaks the row), and the close button stays up beside the sentence. From
          sm up everything is one row, in the order it is written here. */}
      {(showBilling || isDraft) && <span aria-hidden className="order-1 basis-full sm:hidden" />}
      {showBilling && (
        <Link
          to="/settings?tab=billing"
          data-slot="access-banner-link"
          className="order-1 ms-8 mb-1 inline-flex min-h-11 shrink-0 items-center rounded-full bg-paper-raised px-4 text-[13px] font-semibold text-ink ring-1 ring-line-strong/40 transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 sm:order-none sm:ms-0 sm:mb-0 pointer-fine:min-h-9"
        >
          {t.billingLink}
        </Link>
      )}
      {isDraft && (
        <Button
          size="sm"
          className="order-1 me-2 mb-1.5 min-h-11 w-full rounded-full px-4 sm:order-none sm:me-0 sm:mb-0 sm:w-auto"
          onClick={() => openGoLive(access.draftPlan ?? null)}
        >
          {t.subscribe}
        </Button>
      )}
      {notice.dismissible && (
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(storageKey(workspaceId, notice.key), localDay());
            } catch {
              // Private mode: dismissed for this visit only.
            }
            setDismissedKey(notice.key);
          }}
          aria-label={t.dismiss}
          title={t.dismiss}
          data-slot="access-banner-dismiss"
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.94] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-fine:size-9"
        >
          <IconClose className="size-5" aria-hidden />
        </button>
      )}
    </div>
    </>
  );
}
