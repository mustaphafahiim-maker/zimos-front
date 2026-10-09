"use client";

import { orderTrackingExtras, type OrderTrackingStep, type OrderTrackingStepKey, type TrackResult } from "@store-builder/api-client";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
import { whatsappNumber } from "@/lib/egypt";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { CopyButton, StatusTimeline, Timeline, TimelineStep, useWhenInWords } from "./StatusTimeline";
import { btnSecondary } from "./ui";

/**
 * Where the order is (SPEC §14.7), read as a timeline: the five steps with
 * their times in words, and — when the order stopped (cancelled, returned,
 * delivery failed) — that as a marked step with what to do next. Under it the
 * courier, its waybill number (one tap copies it), the courier's own tracking
 * page as a button, and a tracking link to copy. Falls back to the four-stage
 * timeline when the API is an older one without these fields.
 */

const STRINGS = {
  en: {
    placed: "Order placed",
    confirmed: "Confirmed",
    shipped: "Shipped",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    current: "Current step",
    done: "Completed",
    cancelled: "This order was cancelled.",
    cancelled_next: "If that wasn't you, message the store — or simply place the order again.",
    returned: "This order went back to the store.",
    returned_next: "Still want it? Message the store to send it again.",
    delivery_failed: "The courier couldn't deliver your order.",
    delivery_failed_next: "The store will call you to arrange another try — keep your phone close.",
    contact: "Message the store",
    contactMessage: (n: string) => `Hello, I'm asking about order ${n}.`,
    courier: "Courier",
    waybill: "Waybill number",
    courierTrack: "Track with the courier",
    copy: "Copy",
    copied: "Copied",
    copyLink: "Copy tracking link",
    linkCopied: "Link copied",
    copyHint: "Anyone with this link can see this order's status.",
  },
  ar: {
    placed: "تم استلام الطلب",
    confirmed: "تم التأكيد",
    shipped: "تم الشحن",
    out_for_delivery: "خرج للتوصيل",
    delivered: "تم التسليم",
    current: "الخطوة الحالية",
    done: "تمت",
    cancelled: "الطلب ده اتلغى.",
    cancelled_next: "لو مش إنت اللي لغيته، كلّم المتجر — أو اطلب تاني في أي وقت.",
    returned: "الطلب رجع للمتجر.",
    returned_next: "لسه عايزه؟ كلّم المتجر يبعتهولك تاني.",
    delivery_failed: "المندوب معرفش يسلّم الطلب.",
    delivery_failed_next: "المتجر هيكلّمك يرتّب محاولة تانية — خلّي موبايلك جنبك.",
    contact: "كلّم المتجر",
    contactMessage: (n: string) => `أهلًا، بسأل عن طلب رقم ${n}.`,
    courier: "شركة الشحن",
    waybill: "رقم البوليصة",
    courierTrack: "تابع الشحنة عند شركة الشحن",
    copy: "نسخ",
    copied: "اتنسخ",
    copyLink: "انسخ لينك التتبع",
    linkCopied: "اللينك اتنسخ",
    copyHint: "أي حد معاه اللينك ده يقدر يشوف حالة الطلب.",
  },
  fr: {
    placed: "Commande reçue",
    confirmed: "Confirmée",
    shipped: "Expédiée",
    out_for_delivery: "En cours de livraison",
    delivered: "Livrée",
    current: "Étape en cours",
    done: "Terminée",
    cancelled: "Cette commande a été annulée.",
    cancelled_next: "Ce n'était pas vous ? Écrivez à la boutique — ou repassez commande.",
    returned: "Cette commande est retournée à la boutique.",
    returned_next: "Vous la voulez toujours ? Écrivez à la boutique pour un nouvel envoi.",
    delivery_failed: "Le livreur n'a pas pu remettre votre commande.",
    delivery_failed_next: "La boutique vous appellera pour une nouvelle tentative — gardez votre téléphone à portée.",
    contact: "Écrire à la boutique",
    contactMessage: (n: string) => `Bonjour, je vous écris au sujet de la commande ${n}.`,
    courier: "Transporteur",
    waybill: "Numéro de suivi",
    courierTrack: "Suivre chez le transporteur",
    copy: "Copier",
    copied: "Copié",
    copyLink: "Copier le lien de suivi",
    linkCopied: "Lien copié",
    copyHint: "Toute personne ayant ce lien peut voir l'état de cette commande.",
  },
};

type TimelineRow = { step: OrderTrackingStep; index: number } | "problem";

export function TrackOrderProgress({ result }: { result: TrackResult }) {
  const { locale, store } = useStore();
  const t = pickText(STRINGS, locale);
  const when = useWhenInWords();
  const { steps, state, shipment, trackingToken } = orderTrackingExtras(result);

  if (!steps || steps.length === 0) return <StatusTimeline stage={result.stage} />;

  const stopped = state && state !== "active" ? state : null;
  // The first step not reached yet is the one in progress — unless the order stopped.
  const currentIndex = stopped ? -1 : steps.findIndex((s) => !s.reached);
  const lastReached = steps.reduce((last, s, i) => (s.reached ? i : last), -1);
  // A cancelled or returned order goes no further: the steps it never reached are left out, and
  // the timeline ends on what happened. A failed delivery can still be tried again, so its steps stay.
  const shown = stopped === "cancelled" || stopped === "returned" ? steps.slice(0, lastReached + 1) : steps;
  const rows: TimelineRow[] = [];
  if (stopped && lastReached < 0) rows.push("problem");
  shown.forEach((step, index) => {
    rows.push({ step, index });
    if (stopped && index === lastReached) rows.push("problem");
  });

  const whatNext = { cancelled: t.cancelled_next, returned: t.returned_next, delivery_failed: t.delivery_failed_next };
  const wa = store?.phone ? whatsappNumber(store.phone) : null;
  const courierUrl = shipment?.trackingUrl && /^https?:\/\//.test(shipment.trackingUrl) ? shipment.trackingUrl : null;

  return (
    <div>
      {stopped && (
        <p role="status" className="sr-only">
          {t[stopped]} {whatNext[stopped]}
        </p>
      )}

      <Timeline>
        {rows.map((row, i) => {
          const last = i === rows.length - 1;
          if (row === "problem") {
            if (!stopped) return null;
            return (
              <TimelineStep key="problem" state="problem" title={t[stopped]} last={last}>
                <p className="mt-1 text-sm leading-relaxed text-ink">{whatNext[stopped]}</p>
                {wa && (
                  <a
                    href={`https://wa.me/${wa}?text=${encodeURIComponent(t.contactMessage(result.orderNumber))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${btnSecondary} mt-3`}
                  >
                    <WhatsappLogoIcon size={18} aria-hidden />
                    {t.contact}
                  </a>
                )}
              </TimelineStep>
            );
          }
          const { step, index } = row;
          const current = index === currentIndex;
          return (
            <TimelineStep
              key={step.key}
              state={step.reached ? "done" : current ? "current" : "todo"}
              title={t[step.key as OrderTrackingStepKey] ?? step.key}
              last={last}
              lineDone={step.reached}
              badge={current ? t.current : undefined}
              srState={step.reached ? t.done : undefined}
              time={step.reached ? when(step.at) || undefined : undefined}
            />
          );
        })}
      </Timeline>

      {shipment && (shipment.carrier || shipment.waybillNumber || courierUrl) && (
        <div className="mt-6 rounded-2xl border border-line bg-paper p-4">
          <dl className="space-y-2 text-sm">
            {shipment.carrier && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{t.courier}</dt>
                <dd className="font-medium text-ink">{shipment.carrier}</dd>
              </div>
            )}
            {shipment.waybillNumber && (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <dt className="text-ink-soft">{t.waybill}</dt>
                <dd className="min-w-0">
                  <CopyButton value={shipment.waybillNumber} copy={t.copy} copied={t.copied}>
                    <bdi dir="ltr" className="min-w-0 break-all font-medium">
                      {shipment.waybillNumber}
                    </bdi>
                  </CopyButton>
                </dd>
              </div>
            )}
          </dl>
          {courierUrl && (
            <a href={courierUrl} target="_blank" rel="noopener noreferrer" className={`${btnSecondary} mt-3 w-full`}>
              {t.courierTrack}
              <ArrowSquareOutIcon size={18} aria-hidden className="rtl:-scale-x-100" />
            </a>
          )}
        </div>
      )}

      {trackingToken && (
        <div className="mt-4">
          {/* No clipboard at all: the link is shown so it can be copied by hand. */}
          <CopyButton
            value={() => `${window.location.origin}${window.location.pathname}?t=${encodeURIComponent(trackingToken)}`}
            copy={t.copyLink}
            copied={t.linkCopied}
            onFail={(url) => window.prompt(t.copyLink, url)}
          />
          <p className="mt-1 text-xs text-ink-soft">{t.copyHint}</p>
        </div>
      )}
    </div>
  );
}
