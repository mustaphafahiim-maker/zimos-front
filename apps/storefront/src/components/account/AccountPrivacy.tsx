"use client";

import { useId, useState, type FormEvent } from "react";
import {
  PRIVACY_NOTE_MAX,
  shopperPrivacyErase,
  shopperPrivacyExport,
  shopperPrivacyRequests,
  type ShopperPrivacyRequest,
} from "@store-builder/api-client";
import { btnGhost, btnPrimary, btnSecondary, card, input, label, skeleton } from "@/components/ui";
import { isShopperSignedOutError } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { btnDanger, btnGhostDanger, Notice, useAccount } from "./AccountShell";
import { useShopperRead } from "./AccountWalletTabs";
import { usePrivacyCopy, type PrivacyCopy } from "./privacyCopy";

/**
 * The account's «الخصوصية» page (handoff 235): «نزّل بياناتي» saves a copy of
 * everything the store holds about the shopper, «امسح حسابي» asks the store
 * to erase the account (the store reviews it), and the request's status shows
 * with the store's note. The tab that leads here is in AccountPrivacyTab.tsx.
 */

/** Hands the shopper their data as a file named like the API's own download. */
function saveJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Message = { tone: "ok" | "error"; text: string };

function MessageLine({ message }: { message: Message | null }) {
  return (
    <div aria-live="polite" className="empty:hidden">
      {message && (
        <p className={`mt-3 rounded-xl px-4 py-3 text-sm ${message.tone === "ok" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{message.text}</p>
      )}
    </div>
  );
}

function statusOf(request: ShopperPrivacyRequest, copy: PrivacyCopy): { text: string; className: string } {
  // Waiting is neither good nor bad news: neutral, whatever the store's own colour is.
  if (request.status === "pending") return { text: copy.statusPending, className: "border border-line bg-paper text-ink" };
  if (request.status === "declined") return { text: copy.statusDeclined, className: "bg-danger-soft text-danger" };
  return { text: copy.statusCompleted, className: "bg-success-soft text-success" };
}

export function AccountPrivacy() {
  const { t, intlLocale } = useStore();
  const copy = usePrivacyCopy();
  const { api } = useAccount();
  const reasonId = useId();
  const [state, reload] = useShopperRead<ShopperPrivacyRequest[]>(api, shopperPrivacyRequests);
  const [downloading, setDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<Message | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<Message | null>(null);
  // The request just sent, shown at once while the list is read again behind it.
  const [justAsked, setJustAsked] = useState<ShopperPrivacyRequest | null>(null);

  if (state.status === "error") {
    return (
      <Notice
        tone="danger"
        title={t.account.loadFailed}
        action={
          <button type="button" onClick={reload} className={btnPrimary}>
            {t.account.retry}
          </button>
        }
      />
    );
  }
  if (state.status === "loading" && !justAsked) {
    return (
      <div className="grid gap-5 lg:grid-cols-2" aria-hidden>
        <div className={`${skeleton} h-44 w-full`} />
        <div className={`${skeleton} h-44 w-full`} />
      </div>
    );
  }

  // Only a request to delete the account has a status to follow: a copy of the data is handed over at once.
  const loaded = state.status === "ready" ? state.data.filter((request) => request.kind === "erase") : [];
  const requests = justAsked && !loaded.some((request) => request.id === justAsked.id) ? [justAsked, ...loaded] : loaded;
  const waiting = requests.some((request) => request.status === "pending");
  const date = (iso: string) => new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(new Date(iso));

  async function download() {
    if (downloading) return;
    setDownloading(true);
    setDownloadMessage(null);
    try {
      const data = await api.call((client, storeId, token) => shopperPrivacyExport(client, storeId, token));
      saveJson(data, "my-data.json");
      setDownloadMessage({ tone: "ok", text: copy.downloaded });
    } catch (err) {
      // A 401 has already dropped the token: the sign-in shows by itself.
      if (!isShopperSignedOutError(err)) setDownloadMessage({ tone: "error", text: copy.failed });
    } finally {
      setDownloading(false);
    }
  }

  async function askToDelete(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setDeleteMessage(null);
    try {
      const request = await api.call((client, storeId, token) => shopperPrivacyErase(client, storeId, token, reason));
      setJustAsked(request);
      setConfirming(false);
      setReason("");
      setDeleteMessage({ tone: "ok", text: copy.sent });
      reload();
    } catch (err) {
      if (!isShopperSignedOutError(err)) setDeleteMessage({ tone: "error", text: copy.failed });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={`${card} p-5 sm:p-6`} aria-labelledby="account-privacy-download">
        <h2 id="account-privacy-download" className="text-base font-semibold text-ink">
          {copy.downloadTitle}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{copy.downloadHint}</p>
        <button type="button" disabled={downloading} onClick={() => void download()} className={`${btnSecondary} mt-4 w-full sm:w-auto`}>
          {downloading ? copy.downloading : copy.downloadTitle}
        </button>
        <MessageLine message={downloadMessage} />
      </section>

      <section className={`${card} p-5 sm:p-6`} aria-labelledby="account-privacy-delete">
        <h2 id="account-privacy-delete" className="text-base font-semibold text-ink">
          {copy.deleteTitle}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{copy.deleteHint}</p>
        {waiting ? (
          <p className="mt-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink">{copy.underReview}</p>
        ) : confirming ? (
          <form onSubmit={askToDelete} className="mt-4 rounded-xl bg-danger-soft p-3">
            <p className="text-sm font-medium text-danger">{copy.deleteWarning}</p>
            <label htmlFor={reasonId} className={`${label} mt-3`}>
              {copy.reasonLabel}
              <span className="ms-1 text-xs font-normal text-ink-soft">({t.common.optional})</span>
            </label>
            <textarea
              id={reasonId}
              value={reason}
              maxLength={PRIVACY_NOTE_MAX}
              rows={2}
              dir="auto"
              disabled={sending}
              onChange={(e) => setReason(e.target.value)}
              className={`${input} min-h-20 resize-y`}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" disabled={sending} className={btnDanger}>
                {sending ? copy.sending : copy.confirmDelete}
              </button>
              <button type="button" disabled={sending} onClick={() => setConfirming(false)} className={btnGhost}>
                {t.account.cancel}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDeleteMessage(null);
              setConfirming(true);
            }}
            className={`${btnGhostDanger} mt-4 w-full sm:w-auto`}
          >
            {copy.deleteTitle}
          </button>
        )}
        <MessageLine message={deleteMessage} />
      </section>

      {requests.length > 0 && (
        <section className="lg:col-span-2" aria-labelledby="account-privacy-requests">
          <h2 id="account-privacy-requests" className="text-base font-semibold text-ink">
            {copy.requestsTitle}
          </h2>
          <ul className={`${card} mt-3 divide-y divide-line`}>
            {requests.map((request) => {
              const status = statusOf(request, copy);
              return (
                <li key={request.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 py-3 text-sm sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{copy.requestDelete}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">{copy.askedOn(date(request.createdAt))}</p>
                    {request.decisionNote && (
                      <p dir="auto" className="mt-1.5 break-words text-sm text-ink">
                        {copy.storeNote(request.decisionNote)}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
