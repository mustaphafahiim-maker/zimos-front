import type { ComponentType } from "react";
import {
  Bell,
  CalendarClock,
  CalendarX,
  CircleAlert,
  CircleCheck,
  LifeBuoy,
  Receipt,
  Store,
  Ticket,
  UserPlus,
  UserX,
} from "lucide-react";
import { ApiError, type AdminNotification } from "@store-builder/api-client";
import { formatDate, formatMinorMoney } from "@/lib/format";

/**
 * Console notifications (handoff 338): the label, the icon and the line of
 * each type. The server's `title` is English and only a fallback.
 */

export const NOTIFICATION_LABELS: Record<string, string> = {
  user_signup: "New sign-up",
  workspace_created: "New store",
  user_suspended: "Account suspended",
  subscription_activated: "Subscription activated",
  subscription_expiring: "Subscription ending soon",
  subscription_expired: "Subscription ended",
  referral_signup: "Joined with a referral code",
  payment_failed: "Subscription payment failed",
  payment_proof_submitted: "Payment proof sent",
  support_ticket: "New support ticket",
};

export function notificationLabel(type: string): string {
  return NOTIFICATION_LABELS[type] ?? type.replace(/_/g, " ");
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  user_signup: UserPlus,
  workspace_created: Store,
  user_suspended: UserX,
  subscription_activated: CircleCheck,
  subscription_expiring: CalendarClock,
  subscription_expired: CalendarX,
  referral_signup: Ticket,
  payment_failed: CircleAlert,
  payment_proof_submitted: Receipt,
  support_ticket: LifeBuoy,
};

export function notificationIcon(type: string): ComponentType<{ className?: string }> {
  return ICONS[type] ?? Bell;
}

const PRICING_KIND: Record<string, string> = { paid: "paid", free: "free", discounted: "discounted" };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function money(data: Record<string, unknown>): string | null {
  return typeof data.amount === "number" ? formatMinorMoney(data.amount, text(data.currency) ?? undefined) : null;
}

/** The row's line; falls back to the server's `title` when what the line needs is missing. */
export function notificationLine(n: AdminNotification): string {
  const data = n.data ?? {};
  const store = n.workspaceName;
  const person = n.subjectUserName;
  const body = text(n.body);
  switch (n.type) {
    case "user_signup":
      return person ? `${person} signed up${data.method === "google" ? " with Google" : ""}` : n.title;
    case "workspace_created":
      return store ? `New store: ${store}` : n.title;
    case "user_suspended":
      return person ? `${person}'s account was suspended${body ? `: ${body}` : ""}` : n.title;
    case "subscription_activated": {
      if (!store) return n.title;
      const pricing = data.pricing as { kind?: string } | undefined;
      if (pricing?.kind) return `${store}'s subscription was activated by hand (${PRICING_KIND[pricing.kind] ?? pricing.kind})`;
      if (data.action === "billing_invoice.record_payment") return `Payment recorded for ${store}; subscription active`;
      return n.title;
    }
    case "subscription_expiring": {
      const end = text(data.periodEnd);
      return store && end ? `${store}'s subscription ends on ${formatDate(end)}` : n.title;
    }
    case "subscription_expired":
      if (!store) return n.title;
      return data.action === "subscription.manual_pricing_expired"
        ? `${store}'s free or discounted period ended and was not renewed`
        : `${store}'s subscription ended`;
    case "payment_proof_submitted": {
      const amount = money(data);
      if (!store || !amount) return n.title;
      return data.purpose === "topup" ? `${store} sent a balance top-up proof for ${amount}` : `${store} sent a payment proof for ${amount}`;
    }
    case "payment_failed": {
      const amount = money(data);
      if (!store) return n.title;
      return `${store}'s subscription payment failed${amount ? ` (${amount})` : ""}${body ? `: ${body}` : ""}`;
    }
    case "support_ticket": {
      const subject = text(data.subject);
      return store ? `New ticket from ${store}${subject ? `: ${subject}` : ""}` : n.title;
    }
    case "referral_signup":
      return store ? `${store} joined with a referral code` : n.title;
    default:
      return n.title;
  }
}

/** The free text shown under the line — only where the line does not already carry it. */
export function notificationNote(n: AdminNotification): string | null {
  return n.type === "subscription_activated" ? text(n.body) : null;
}

/** The store or account the row is about. */
export function notificationSubject(n: AdminNotification): string | null {
  return n.workspaceName ?? n.subjectUserName ?? null;
}

/**
 * The console route a notification opens. The server's `link` uses the
 * console's own paths (App.tsx): an account, a store, a transfer proof, a
 * ticket. Anything else falls back to the store or the account it is about.
 */
export function notificationRoute(n: AdminNotification): string | null {
  const link = n.link ?? "";
  if (/^\/(users|workspaces|tickets|payment-proofs)\/[^/]+$/.test(link)) return link;
  if (n.workspaceId) return `/workspaces/${n.workspaceId}`;
  if (n.subjectUserId) return `/users/${n.subjectUserId}`;
  return null;
}

/** 403 → the console's permission line; anything else → try again. */
export function notificationError(err: unknown): string {
  return err instanceof ApiError && err.status === 403 ? "This page needs a console permission" : "Something went wrong, try again";
}

/** The bell and the page tell each other the unread count changed. */
const CHANGED = "zimos:admin-notifications-unread";

export function announceUnread(unread: number) {
  window.dispatchEvent(new CustomEvent<number>(CHANGED, { detail: unread }));
}

export function onUnreadAnnounced(listener: (unread: number) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<number>).detail);
  window.addEventListener(CHANGED, handler);
  return () => window.removeEventListener(CHANGED, handler);
}
