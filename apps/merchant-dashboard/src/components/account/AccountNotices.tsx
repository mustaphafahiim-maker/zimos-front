import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@store-builder/ui";
import {
  ApiError,
  accountErrorCode,
  apiErrorDetails,
  ownershipOfferAccept,
  ownershipOfferDecline,
  ownershipOffers,
  type OwnershipOffer,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { openEmailConfirm, useAccountFlags, useEmailConfirmState } from "@/lib/emailConfirm";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconEmail, IconStore } from "@/components/icons";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    confirmEmail: "Confirm your email to publish your store and start your free trial.",
    sendCode: "Send me a code",
    offer: "{from} wants to give you {store}",
    offerUntil: "The offer is open until {date}.",
    accept: "Accept",
    decline: "Decline",
    acceptTitle: "Take over {store}?",
    acceptNote: "The store will count toward your plan's stores",
    acceptConfirm: "Accept the store",
    cancel: "Cancel",
    working: "Working…",
    accepted: "{store} is yours now",
    declined: "You declined the offer.",
    gone: "This offer is no longer available.",
    planFull: "Your plan has no room for another store ({used} of {max}). Upgrade your plan first, then accept.",
    planFullPlain: "Your plan has no room for another store. Upgrade your plan first, then accept.",
  },
  ar: {
    confirmEmail: "أكّد إيميلك عشان تقدر تنشر متجرك وتبدأ التجربة المجانية.",
    sendCode: "ابعتلي كود",
    offer: "{from} عايز ينقل لك ملكية {store}",
    offerUntil: "العرض مفتوح لحد {date}.",
    accept: "موافق",
    decline: "رفض",
    acceptTitle: "تستلم {store}؟",
    acceptNote: "المتجر هيتحسب من عدد متاجر باقتك",
    acceptConfirm: "استلم المتجر",
    cancel: "إلغاء",
    working: "بننفّذ…",
    accepted: "{store} بقى ملكك",
    declined: "رفضت العرض.",
    gone: "العرض ده مبقاش متاح.",
    planFull: "باقتك مفيهاش مكان لمتجر كمان ({used} من {max}). رقّي باقتك الأول وبعدين وافق.",
    planFullPlain: "باقتك مفيهاش مكان لمتجر كمان. رقّي باقتك الأول وبعدين وافق.",
  },
} satisfies Messages;

/** One line above the page, in the access banner's own shape (it shares its slot, so it shares its look). */
function Notice({ icon, children, actions }: { icon: ReactNode; children: ReactNode; actions: ReactNode }) {
  return (
    <div
      role="status"
      data-slot="access-banner"
      data-tone="warning"
      className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[1.25rem] border border-accent/30 bg-accent-soft py-1.5 ps-4 pe-2 text-sm text-ink"
    >
      <span data-slot="access-banner-icon" className="me-1 shrink-0 text-accent-dark [&>svg]:size-5" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1 basis-40 py-1.5 pe-2 leading-6">{children}</div>
      <div className="flex w-full shrink-0 flex-wrap gap-2 pb-1.5 sm:w-auto sm:pb-0">{actions}</div>
    </div>
  );
}

const PILL = "min-h-11 flex-1 rounded-full px-4 sm:flex-none pointer-fine:min-h-9";

/**
 * What the account itself is waiting on, above every page of the dashboard:
 * the email still to confirm (handoff 330) and a store someone wants to hand
 * over (handoff 379).
 */
export function AccountNotices() {
  return (
    <>
      <ConfirmEmailNotice />
      <OwnershipOfferNotices />
    </>
  );
}

function ConfirmEmailNotice() {
  const t = useT(STRINGS);
  const { user } = useAuth();
  const flags = useAccountFlags(apiClient, user?.id);
  // Confirmed in the dialog a moment ago: gone before /auth/me is read again.
  useEmailConfirmState();
  if (!user || !flags || flags.confirmed) return null;
  return (
    <Notice
      icon={<IconEmail weight="fill" />}
      actions={
        <Button size="sm" className={PILL} onClick={() => openEmailConfirm()}>
          {t.sendCode}
        </Button>
      }
    >
      {t.confirmEmail}
    </Notice>
  );
}

function OwnershipOfferNotices() {
  const t = useT(STRINGS);
  const { user } = useAuth();
  const { refresh, selectWorkspace } = useWorkspace();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [offers, setOffers] = useState<OwnershipOffer[]>([]);
  const [accepting, setAccepting] = useState<OwnershipOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let live = true;
    ownershipOffers(apiClient)
      .then((list) => live && setOffers(list))
      .catch(() => {
        // An offer that can't be read is simply not shown.
      });
    return () => {
      live = false;
    };
  }, [userId]);

  const drop = (offer: OwnershipOffer) => setOffers((list) => list.filter((o) => o.workspaceId !== offer.workspaceId));
  const fromName = (offer: OwnershipOffer) => offer.from.fullName?.trim() || offer.from.email;

  async function accept() {
    const offer = accepting;
    if (!offer) return;
    try {
      await ownershipOfferAccept(apiClient, offer.workspaceId);
      toast.success(fmt(t.accepted, { store: offer.workspaceName }));
      drop(offer);
      setAccepting(null);
      // The role changed for every screen: the stores are read again, then this one opens.
      await refresh();
      selectWorkspace(offer.workspaceId);
    } catch (err) {
      setAccepting(null);
      const code = accountErrorCode(err);
      if (code === "PLAN_LIMIT_REACHED") {
        const limit = apiErrorDetails<{ max?: number; used?: number }>(err);
        toast.error(limit?.max !== undefined && limit.used !== undefined ? fmt(t.planFull, { used: limit.used, max: limit.max }) : t.planFullPlain);
      } else if (code === "OFFER_NO_LONGER_VALID" || (err instanceof ApiError && err.status === 404)) {
        toast.error(t.gone);
        drop(offer);
      } else {
        toast.error(errorMessage(err));
      }
    }
  }

  async function decline(offer: OwnershipOffer) {
    setBusy(true);
    try {
      await ownershipOfferDecline(apiClient, offer.workspaceId);
      toast.success(t.declined);
      drop(offer);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        toast.error(t.gone);
        drop(offer);
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  if (offers.length === 0) return null;
  return (
    <>
      {offers.map((offer) => (
        <Notice
          key={offer.workspaceId}
          icon={<IconStore weight="fill" />}
          actions={
            <>
              <Button size="sm" className={PILL} disabled={busy} onClick={() => setAccepting(offer)}>
                {t.accept}
              </Button>
              <Button size="sm" variant="outline" className={PILL} disabled={busy} onClick={() => void decline(offer)}>
                {t.decline}
              </Button>
            </>
          }
        >
          <span className="font-medium">{fmt(t.offer, { from: fromName(offer), store: offer.workspaceName })}</span>
          <span className="block text-[13px] leading-5 text-ink-soft">{fmt(t.offerUntil, { date: formatDate(offer.expiresAt) })}</span>
        </Notice>
      ))}
      <ConfirmDialog
        open={accepting !== null}
        title={accepting ? fmt(t.acceptTitle, { store: accepting.workspaceName }) : ""}
        description={t.acceptNote}
        confirmLabel={t.acceptConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        onCancel={() => setAccepting(null)}
        onConfirm={accept}
      />
    </>
  );
}
