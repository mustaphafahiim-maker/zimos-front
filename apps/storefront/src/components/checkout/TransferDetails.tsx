"use client";

import { useEffect, useRef, useState } from "react";
import {
  manualTransferDepositQuote,
  type ApiClient,
  type ManualTransferCheckoutDetails,
  type ManualTransferDepositQuote,
  type ManualTransferStoreMethod,
  type StorefrontPaymentMethod,
} from "@store-builder/api-client";
import { input } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";

/**
 * Manual transfer at checkout (SPEC §11.3): the store's instructions, the
 * receipt photo and the sender's number — for paying the whole order by
 * transfer, or for the deposit a cash-on-delivery order needs first.
 *
 * The strings live here rather than in lib/i18n.ts so this feature stays in
 * its own files.
 */
const COPY = {
  en: {
    hint: "Transfer the amount, then upload the receipt",
    instructions: "How to pay",
    amountFull: "Amount to transfer",
    depositTitle: "A deposit is needed before delivery",
    depositShipping: "Transfer the shipping fee now; you pay the rest on delivery.",
    depositFixed: "Transfer the deposit now; you pay the rest on delivery.",
    depositAmount: "Deposit",
    payWith: "Transfer by",
    receipt: "Photo of the transfer receipt",
    choose: "Upload the receipt",
    change: "Change the photo",
    uploading: "Uploading…",
    uploaded: "Receipt uploaded",
    uploadFailed: "The photo could not be uploaded. Try again.",
    wrongType: "Use a JPG, PNG or WebP photo.",
    sender: "The number or account you transferred from",
    needReceipt: "Upload a photo of the transfer receipt.",
    needSender: "Enter the number or account you transferred from.",
    review: "We confirm your order once the transfer is checked.",
    optional: "(optional)",
  },
  ar: {
    hint: "حوّل المبلغ ثم ارفع صورة الإيصال",
    instructions: "طريقة الدفع",
    amountFull: "المبلغ المطلوب تحويله",
    depositTitle: "مطلوب عربون قبل التوصيل",
    depositShipping: "حوّل مصاريف الشحن الآن، وادفع الباقي عند الاستلام.",
    depositFixed: "حوّل العربون الآن، وادفع الباقي عند الاستلام.",
    depositAmount: "العربون",
    payWith: "التحويل عبر",
    receipt: "صورة إيصال التحويل",
    choose: "ارفع صورة الإيصال",
    change: "غيّر الصورة",
    uploading: "جارٍ الرفع…",
    uploaded: "تم رفع الإيصال",
    uploadFailed: "تعذّر رفع الصورة. حاول مرة أخرى.",
    wrongType: "استخدم صورة JPG أو PNG أو WebP.",
    sender: "الرقم أو الحساب الذي حوّلت منه",
    needReceipt: "ارفع صورة إيصال التحويل.",
    needSender: "اكتب الرقم أو الحساب الذي حوّلت منه.",
    review: "نؤكد طلبك بعد مراجعة التحويل.",
    optional: "(اختياري)",
  },
};

export function useTransferCopy() {
  const { locale } = useStore();
  return locale === "ar" ? COPY.ar : COPY.en;
}

/** The storefront's method type does not name transfers yet; this narrows one. */
export function asTransferMethod(method: StorefrontPaymentMethod | undefined): ManualTransferStoreMethod | null {
  const m = method as unknown as ManualTransferStoreMethod | undefined;
  return m && m.provider === "manual" ? m : null;
}

/** Whether a cash-on-delivery order by this phone needs a deposit; asked again when the phone changes. */
export function useDepositQuote(client: ApiClient, workspaceId: string, phone: string, enabled: boolean) {
  const [quote, setQuote] = useState<ManualTransferDepositQuote | null>(null);
  const digits = phone.replace(/\D/g, "");
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    // A quote for "everyone" does not need the phone; a risk-based one does.
    const timer = setTimeout(() => {
      manualTransferDepositQuote(client, workspaceId, digits.length >= 10 ? phone : "")
        .then((q) => live && setQuote(q))
        .catch(() => live && setQuote(null));
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, workspaceId, digits.length >= 10 ? digits : "", enabled]);
  return enabled && quote?.required ? quote : null;
}

export interface TransferState {
  details: ManualTransferCheckoutDetails;
  uploading: boolean;
}

/** What is still missing, as a message; null when the transfer can be sent. */
export function transferProblem(
  method: ManualTransferStoreMethod,
  state: TransferState | null,
  copy: ReturnType<typeof useTransferCopy>
): string | null {
  if (state?.uploading) return copy.uploading;
  if (method.requireReceipt && !state?.details.receiptUploadId) return copy.needReceipt;
  if (method.requireSender && !state?.details.senderReference?.trim()) return copy.needSender;
  return null;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function TransferDetails({
  client,
  workspaceId,
  methods,
  amountLabel,
  deposit,
  idPrefix,
  onChange,
}: {
  client: ApiClient;
  workspaceId: string;
  /** One method when the shopper picked it in the payment list; the store's list for a deposit. */
  methods: ManualTransferStoreMethod[];
  /** The formatted amount to transfer, when it is known. */
  amountLabel: string | null;
  /** Set for a deposit on a cash-on-delivery order. */
  deposit?: "shipping" | "fixed";
  idPrefix: string;
  onChange: (method: ManualTransferStoreMethod, state: TransferState) => void;
}) {
  const copy = useTransferCopy();
  const file = useRef<HTMLInputElement>(null);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const method = methods.find((m) => m.id === methodId) ?? methods[0];
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [sender, setSender] = useState("");

  useEffect(() => {
    if (!method) return;
    onChange(method, {
      details: { methodId: method.id, receiptUploadId: uploadId, senderReference: sender.trim() || null },
      uploading: status === "uploading",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method?.id, uploadId, sender, status]);

  if (!method) return null;

  async function onFile(picked: File | undefined) {
    if (!picked) return;
    setMessage(null);
    if (!ACCEPTED.includes(picked.type) && !/\.(jpe?g|png|webp)$/i.test(picked.name)) {
      setStatus("error");
      return setMessage(copy.wrongType);
    }
    setPreview(URL.createObjectURL(picked));
    setStatus("uploading");
    setUploadId(null);
    try {
      const upload = await client.uploadCustomerPhoto(workspaceId, picked, { visitorId: getVisitorId(workspaceId) });
      setUploadId(upload.uploadId);
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage(copy.uploadFailed);
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-line bg-paper-raised p-4">
      {deposit && (
        <div>
          <p className="text-sm font-semibold text-ink">{copy.depositTitle}</p>
          <p className="mt-0.5 text-sm text-ink-soft">{deposit === "fixed" ? copy.depositFixed : copy.depositShipping}</p>
        </div>
      )}

      {methods.length > 1 && (
        <div>
          <label htmlFor={`${idPrefix}-transfer-method`} className="mb-1.5 block text-sm font-medium text-ink">
            {copy.payWith}
          </label>
          <select id={`${idPrefix}-transfer-method`} className={input} value={method.id} onChange={(e) => setMethodId(e.target.value)}>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-ink-soft">
          {copy.instructions}
          {methods.length === 1 ? ` — ${method.name}` : ""}
        </p>
        <p className="mt-1 whitespace-pre-line text-sm text-ink" dir="auto">
          {method.instructions}
        </p>
        {amountLabel && (
          <p className="mt-2 text-sm text-ink-soft">
            {deposit ? copy.depositAmount : copy.amountFull}: <bdi className="font-semibold text-ink">{amountLabel}</bdi>
          </p>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">
          {copy.receipt} {!method.requireReceipt && <span className="font-normal text-ink-soft">{copy.optional}</span>}
        </p>
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={copy.receipt}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <div className="flex flex-wrap items-center gap-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-16 rounded-lg border border-line object-cover" />
          )}
          <button
            type="button"
            onClick={() => file.current?.click()}
            className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink hover:border-primary"
          >
            {status === "uploading" ? copy.uploading : preview ? copy.change : copy.choose}
          </button>
          {status === "done" && <span className="text-sm font-medium text-success">{copy.uploaded}</span>}
        </div>
        {message && (
          <p role="alert" className="mt-1.5 text-sm text-danger">
            {message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${idPrefix}-transfer-sender`} className="mb-1.5 block text-sm font-medium text-ink">
          {copy.sender} {!method.requireSender && <span className="font-normal text-ink-soft">{copy.optional}</span>}
        </label>
        <input
          id={`${idPrefix}-transfer-sender`}
          className={input}
          dir="ltr"
          inputMode="tel"
          maxLength={100}
          value={sender}
          onChange={(e) => setSender(e.target.value)}
        />
      </div>

      <p className="text-xs text-ink-soft">{copy.review}</p>
    </div>
  );
}
