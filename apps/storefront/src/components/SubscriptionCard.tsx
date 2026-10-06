"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  subscriptionPortalCardReturn,
  subscriptionPortalCardStart,
  type SubscriptionPortal as Portal,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { btnPrimary, btnSecondary } from "./ui";

const STRINGS = {
  en: {
    card: "Card",
    noCard: "No card on file",
    expires: (date: string) => `expires ${date}`,
    update: "Change card",
    add: "Add a card",
    opening: "Opening…",
    pastDue: "Your last payment failed. Change your card and we will charge it right away.",
    saving: "Saving your card…",
    saved: "Your new card is saved.",
    renewed: "Your new card is saved and the payment went through.",
    stillDue: "Your new card is saved, but the payment failed. We will try again.",
    notSaved: "The card was not saved. You can try again.",
    unsupported: "This store can't take a new card here yet. Please contact the store.",
    failed: "Something went wrong. Please try again.",
  },
  ar: {
    card: "الكارت",
    noCard: "مفيش كارت محفوظ",
    expires: (date: string) => `بينتهي ${date}`,
    update: "غيّر الكارت",
    add: "ضيف كارت",
    opening: "جارٍ الفتح…",
    pastDue: "آخر دفعة فشلت. غيّر الكارت وهنسحب منه على طول.",
    saving: "جارٍ حفظ الكارت…",
    saved: "الكارت الجديد اتحفظ.",
    renewed: "الكارت الجديد اتحفظ والدفعة اتسحبت.",
    stillDue: "الكارت الجديد اتحفظ بس الدفعة فشلت. هنحاول تاني.",
    notSaved: "الكارت ماتحفظش. تقدر تحاول تاني.",
    unsupported: "المتجر مش بيقبل كارت جديد من هنا دلوقتي. كلّم المتجر.",
    failed: "حصلت مشكلة. حاول تاني.",
  },
};

type Note = "saved" | "renewed" | "stillDue" | "notSaved" | "unsupported" | "failed";

const RETURN_FLAG = "card";

/**
 * The portal's card (SPEC §18.1, "update the card via a signed link"): the
 * card renewals are charged to, and a button to the payment provider's own
 * "save a card" page. The provider sends the customer back here with
 * `?card=return&…`; that answer is handed to the API once, then taken out of
 * the address.
 */
export function SubscriptionCardPanel({
  workspaceId,
  token,
  sub,
  onChange,
}: {
  workspaceId: string;
  token: string;
  sub: Portal;
  onChange: (sub: Portal) => void;
}) {
  const { intlLocale } = useStore();
  const t = intlLocale.startsWith("ar") ? STRINGS.ar : STRINGS.en;
  const [busy, setBusy] = useState<"opening" | "saving" | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const url = new URL(window.location.href);
    if (url.searchParams.get(RETURN_FLAG) !== "return") return;
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      if (key !== RETURN_FLAG) query[key] = value;
    });
    // Out of the address first: a reload must not send the same answer twice.
    window.history.replaceState(null, "", url.pathname);
    setBusy("saving");
    subscriptionPortalCardReturn(createStorefrontApiClient(), workspaceId, token, query)
      .then(({ subscription, renewal }) => {
        onChange(subscription);
        setNote(renewal === "renewed" || renewal === "completed" ? "renewed" : renewal ? "stillDue" : "saved");
      })
      .catch((err) => setNote(err instanceof ApiError && err.code === "CARD_NOT_SAVED" ? "notSaved" : "failed"))
      .finally(() => setBusy(null));
  }, [workspaceId, token, onChange]);

  async function update() {
    setBusy("opening");
    setNote(null);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?${RETURN_FLAG}=return`;
      const { redirectUrl } = await subscriptionPortalCardStart(createStorefrontApiClient(), workspaceId, token, returnUrl);
      window.location.assign(redirectUrl);
    } catch (err) {
      setNote(err instanceof ApiError && err.code === "CARD_SETUP_NOT_SUPPORTED" ? "unsupported" : "failed");
      setBusy(null);
    }
  }

  const when = new Intl.DateTimeFormat(intlLocale, { month: "short", year: "numeric" });
  const cardText = sub.card
    ? `${sub.card.brand ?? ""} •••• ${sub.card.last4 ?? "····"}${sub.card.expiresAt ? ` · ${t.expires(when.format(new Date(sub.card.expiresAt)))}` : ""}`
    : t.noCard;

  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-ink-soft">{t.card}</span>
        <span dir="ltr" className="font-medium text-ink">
          {cardText}
        </span>
      </div>
      {sub.status === "past_due" && !note && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{t.pastDue}</p>}
      {busy === "saving" && (
        <p role="status" className="text-sm text-ink-soft">
          {t.saving}
        </p>
      )}
      {note && (
        <p role={note === "saved" || note === "renewed" ? "status" : "alert"} className="text-sm text-ink">
          {t[note]}
        </p>
      )}
      {sub.canUpdateCard && (
        <button type="button" disabled={busy !== null} className={sub.status === "past_due" ? btnPrimary : btnSecondary} onClick={() => void update()}>
          {busy === "opening" ? t.opening : sub.card ? t.update : t.add}
        </button>
      )}
    </div>
  );
}
