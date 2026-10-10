"use client";

import { useId } from "react";
import {
  shopperExchangeOptionsOf,
  shopperReturnCaseOf,
  type ReturnResolution,
  type ShopperExchangeOption,
  type ShopperReturnLine,
  type ShopperReturnSummary,
} from "@store-builder/api-client";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { input } from "../ui";

/**
 * Exchanges and the store's decision on a shopper's return. The words live
 * here, beside the parts that say them, rather than in the shared dictionary.
 */
const COPY = {
  en: {
    refund: "Refund",
    exchange: "Exchange for another size or colour",
    resolutionLegend: "What would you like?",
    exchangeFor: "Exchange for",
    chooseOption: "Choose a size or colour",
    outOfStock: "Out of stock",
    noOptions: "Nothing to exchange this item for right now.",
    requestExchange: "Request exchange",
    chooseExchange: "Choose what you want instead.",
    optionGone: "That size or colour is no longer available — choose another.",
    noExchanges: "This store doesn't take exchanges right now. Ask for a refund instead.",
    status_requested: "Under review",
    status_approved: "Approved",
    status_rejected: "Not accepted",
    status_received: "Received",
    status_refunded: "Refunded",
    exchangeBadge: "Exchange",
    wants: (to: string) => `Exchange for ${to}`,
    storeMessage: (note: string) => `Message from the store: ${note}`,
    replacement: (number: string) => `Replacement order: ${number}`,
  },
  ar: {
    refund: "استرداد المبلغ",
    exchange: "استبدال بمقاس أو لون تاني",
    resolutionLegend: "عايز إيه؟",
    exchangeFor: "استبدله بـ",
    chooseOption: "اختار المقاس أو اللون",
    outOfStock: "نفدت الكمية",
    noOptions: "مفيش مقاس أو لون تاني متاح للمنتج ده دلوقتي.",
    requestExchange: "اطلب الاستبدال",
    chooseExchange: "اختار اللي عايزه بداله.",
    optionGone: "المقاس أو اللون ده مبقاش متاح — اختار غيره.",
    noExchanges: "المتجر مش بيستبدل دلوقتي. اطلب استرداد بداله.",
    status_requested: "قيد المراجعة",
    status_approved: "تمت الموافقة",
    status_rejected: "مرفوض",
    status_received: "تم الاستلام",
    status_refunded: "فلوسك رجعت",
    exchangeBadge: "استبدال",
    wants: (to: string) => `استبدال بـ ${to}`,
    storeMessage: (note: string) => `رسالة المتجر: ${note}`,
    replacement: (number: string) => `طلب الاستبدال: ${number}`,
  },
  fr: {
    refund: "Remboursement",
    exchange: "Échanger contre une autre taille ou couleur",
    resolutionLegend: "Que souhaitez-vous ?",
    exchangeFor: "Échanger contre",
    chooseOption: "Choisissez une taille ou une couleur",
    outOfStock: "Rupture de stock",
    noOptions: "Aucune autre taille ou couleur disponible pour cet article.",
    requestExchange: "Demander l'échange",
    chooseExchange: "Choisissez ce que vous voulez à la place.",
    optionGone: "Cette taille ou couleur n'est plus disponible — choisissez-en une autre.",
    noExchanges: "Cette boutique ne fait pas d'échanges pour le moment. Demandez un remboursement.",
    status_requested: "En cours d'examen",
    status_approved: "Approuvé",
    status_rejected: "Non accepté",
    status_received: "Reçu",
    status_refunded: "Remboursé",
    exchangeBadge: "Échange",
    wants: (to: string) => `Échange contre ${to}`,
    storeMessage: (note: string) => `Message de la boutique : ${note}`,
    replacement: (number: string) => `Commande de remplacement : ${number}`,
  },
};

export type ReturnCaseCopy = (typeof COPY)["en"];

export function useReturnCaseCopy(): ReturnCaseCopy {
  const { locale } = useStore();
  return pickText(COPY, locale);
}

/** The values of a variant, as the shopper reads them: "L", "L / Blue". */
export function exchangeOptionText(option: Pick<ShopperExchangeOption, "options">): string {
  return option.options ? Object.values(option.options).filter(Boolean).join(" / ") : "";
}

/** The shopper's word for a return's status, or null for one this copy does not know. */
export function returnCaseStatusText(copy: ReturnCaseCopy, status: string): string | null {
  const text = (copy as unknown as Record<string, unknown>)[`status_${status}`];
  return typeof text === "string" ? text : null;
}

/** Refund, or exchange for another size or colour. Shown only when the store takes exchanges. */
export function ResolutionChoice({
  value,
  onChange,
  disabled,
}: {
  value: ReturnResolution;
  onChange: (next: ReturnResolution) => void;
  disabled?: boolean;
}) {
  const copy = useReturnCaseCopy();
  const name = useId();
  const options: { value: ReturnResolution; label: string }[] = [
    { value: "refund", label: copy.refund },
    { value: "exchange", label: copy.exchange },
  ];
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-ink">{copy.resolutionLegend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
              value === option.value ? "border-primary bg-primary-soft font-semibold text-ink" : "border-line bg-paper-raised text-ink"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="size-4 shrink-0 accent-primary"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Under a picked line of an exchange: which size or colour the shopper wants instead. */
export function ExchangeLineSelect({
  line,
  value,
  onChange,
  error,
  disabled,
}: {
  line: ShopperReturnLine;
  value: string;
  onChange: (variantId: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const copy = useReturnCaseCopy();
  const id = useId();
  const options = shopperExchangeOptionsOf(line);
  if (options.length === 0) return <p className="mt-2 basis-full text-xs text-ink-soft">{copy.noOptions}</p>;
  return (
    <div className="mt-2 basis-full">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-soft">
        {copy.exchangeFor}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${input} cursor-pointer`}
      >
        <option value="" disabled>
          {copy.chooseOption}
        </option>
        {options.map((option) => (
          <option key={option.variantId} value={option.variantId} disabled={!option.inStock}>
            {exchangeOptionText(option)}
            {option.inStock ? "" : ` — ${copy.outOfStock}`}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Under one of "Your returns": what was asked for instead (an exchange), the
 * store's message with its decision, and the replacement order.
 */
export function ShopperReturnCase({ ret, lines }: { ret: ShopperReturnSummary; lines: ShopperReturnLine[] }) {
  const copy = useReturnCaseCopy();
  const data = shopperReturnCaseOf(ret);

  const wanted =
    data.resolution === "exchange"
      ? data.items
          .map((item) => {
            const line = lines.find((l) => l.orderItemId === item.orderItemId);
            const option = line ? shopperExchangeOptionsOf(line).find((o) => o.variantId === item.exchangeVariantId) : undefined;
            return option ? { id: item.orderItemId, text: exchangeOptionText(option) } : null;
          })
          .filter((entry): entry is { id: string; text: string } => entry !== null && entry.text !== "")
      : [];

  if (data.resolution !== "exchange" && !data.decisionNote && !data.exchangeOrderNumber) return null;

  return (
    <div className="mt-2 space-y-1.5 border-t border-line pt-2 text-sm">
      {data.resolution === "exchange" && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
          <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 font-semibold text-primary">{copy.exchangeBadge}</span>
          {wanted.map((entry) => (
            <bdi key={entry.id}>{copy.wants(entry.text)}</bdi>
          ))}
        </p>
      )}
      {data.decisionNote && (
        <p dir="auto" className="rounded-lg bg-paper-raised px-3 py-2 text-sm text-ink">
          {copy.storeMessage(data.decisionNote)}
        </p>
      )}
      {data.exchangeOrderNumber && (
        <p className="text-sm text-ink">
          <bdi>{copy.replacement(`⁦${data.exchangeOrderNumber}⁩`)}</bdi>
        </p>
      )}
    </div>
  );
}
