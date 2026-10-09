"use client";

import { trackSubscriptionsOf, type TrackResult } from "@store-builder/api-client";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { StoreLink } from "./StoreRoute";
import { focusRing } from "./ui";

const TEXT = {
  en: {
    title: "Your subscription",
    manage: "Manage",
    hint: "Change the card it is charged to, or cancel, from its page.",
    status_trialing: "Free trial",
    status_active: "Active",
    status_past_due: "Payment due",
    status_paused: "Paused",
    status_cancelled: "Cancelled",
    status_completed: "Completed",
  },
  ar: {
    title: "اشتراكك",
    manage: "إدارة",
    hint: "غيّر البطاقة اللي بيتسحب منها أو ألغيه من صفحته.",
    status_trialing: "فترة تجريبية",
    status_active: "مفعّل",
    status_past_due: "مستحق الدفع",
    status_paused: "متوقف مؤقتًا",
    status_cancelled: "ملغي",
    status_completed: "اكتمل",
  },
  fr: {
    title: "Votre abonnement",
    manage: "Gérer",
    hint: "Changez la carte débitée ou résiliez depuis sa page.",
    status_trialing: "Essai gratuit",
    status_active: "Actif",
    status_past_due: "Paiement dû",
    status_paused: "En pause",
    status_cancelled: "Résilié",
    status_completed: "Terminé",
  },
};

/** The subscriptions this order started, each with a link to its page (SPEC §18.1, tracking result `subscriptions`). */
export function TrackOrderSubscriptions({ result }: { result: TrackResult }) {
  const { locale } = useStore();
  const t = pickText(TEXT, locale);
  const subscriptions = trackSubscriptionsOf(result).filter((s) => s.portalPath);
  if (subscriptions.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
      <p className="mt-0.5 text-xs text-ink-soft">{t.hint}</p>
      <ul className="mt-2 space-y-2">
        {subscriptions.map((s) => (
          <li key={s.portalPath} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-paper py-0.5 ps-3 pe-1 text-sm text-ink">
            <span className="min-w-0">
              <bdi className="block truncate">{s.productName}</bdi>
              <span className="text-xs text-ink-soft">{(t as Record<string, string>)[`status_${s.status}`] ?? s.status}</span>
            </span>
            <StoreLink href={s.portalPath as string} className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-3 font-semibold text-primary hover:underline ${focusRing}`}>
              {t.manage}
            </StoreLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
