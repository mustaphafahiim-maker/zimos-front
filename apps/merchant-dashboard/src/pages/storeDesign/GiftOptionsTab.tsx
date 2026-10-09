import { useMemo, useState } from "react";
import { IconGift } from "@/components/icons";
import {
  GIFT_MESSAGE_MAX_LENGTH,
  GIFT_MESSAGE_MIN_LENGTH,
  giftOptionsGet,
  giftOptionsSave,
  isGiftWrapRefused,
  type GiftOptionsSettings,
  type Product,
  type Variant,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, formatOptions } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { SettingsGroup, SettingsLinkRow, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { useStoreProducts } from "@/pages/offers/OfferRuleParts";
import { SettingsFormFooter } from "./SettingsFormFooter";
import { GroupBlock, InputRow, STACK, SelectRow, SettingsSkeleton } from "./sections/parts";

const STRINGS = {
  en: {
    title: "Gift options",
    description: "Shoppers can mark the order as a gift, have it gift-wrapped and write a message. The message prints on the waybill and shows on the order page for whoever packs.",
    stateOn: "On",
    stateOff: "Off",
    enabled: "Offer gift options at checkout",
    enabledHint: "Adds “Is this a gift?” to the checkout.",
    wrap: "Gift-wrap product",
    wrapNone: "No wrap — a message only",
    wrapHint: "A normal product you make and price, like “Gift wrap”. Choosing it adds one at its price to the order.",
    wrapOff: "This product is not on sale, so shoppers won't see the wrap. Turn it on from its page.",
    wrapCreate: "Make a gift-wrap product",
    wrapRefused: "That product isn't in your store anymore. Choose another one.",
    messageLength: "Longest gift message",
    messageLengthHint: "Letters, from {min} to {max}.",
    messageLengthInvalid: "Write a number from {min} to {max}.",
    preview: "What the shopper sees",
    previewGift: "Is this a gift?",
    previewWrap: "Gift-wrap it (+{price})",
    previewMessage: "Gift message",
    previewCounter: "0/{max}",
    previewHide: "Hide prices in the parcel",
    saved: "Saved.",
  },
  ar: {
    title: "خيارات الهدايا",
    description: "العميل يقدر يعلّم إن الطلب هدية، ويخليه يتغلّف، ويكتب رسالة. الرسالة بتتطبع على البوليصة وبتظهر في صفحة الأوردر للي بيجهّز.",
    stateOn: "شغّالة",
    stateOff: "مقفولة",
    enabled: "اعرض خيارات الهدايا في صفحة الدفع",
    enabledHint: "بتضيف «ده هدية؟» لصفحة الدفع.",
    wrap: "منتج التغليف",
    wrapNone: "من غير تغليف — رسالة بس",
    wrapHint: "منتج عادي بتعمله وتسعّره، زي «تغليف هدية». لو العميل اختاره بيتضاف واحد منه للأوردر بسعره.",
    wrapOff: "المنتج ده مش شغّال، فالعميل مش هيشوف التغليف. شغّله من صفحته.",
    wrapCreate: "اعمل منتج للتغليف",
    wrapRefused: "المنتج ده مبقاش في متجرك. اختار غيره.",
    messageLength: "أطول رسالة إهداء",
    messageLengthHint: "عدد الحروف، من {min} لـ {max}.",
    messageLengthInvalid: "اكتب رقم من {min} لـ {max}.",
    preview: "العميل هيشوف إيه",
    previewGift: "ده هدية؟",
    previewWrap: "غلّفها كهدية (+{price})",
    previewMessage: "رسالة الإهداء",
    previewCounter: "٠/{max}",
    previewHide: "اخفي الأسعار في الشحنة",
    saved: "اتحفظ.",
  },
} satisfies Messages;

/**
 * Store settings → Gift options (handoff 214): the checkout's "Is this a
 * gift?" with an optional wrap product and a message. Reading needs
 * products.view (a 403 draws the no-permission card), saving
 * products.manage (the save says so).
 */
export function GiftOptionsTab() {
  const workspaceId = useWorkspaceId();
  const loaded = useAsync(() => giftOptionsGet(apiClient, workspaceId), [workspaceId]);
  const saved = loaded.data;
  return (
    <DataState loading={loaded.loading && !saved} error={loaded.error} onRetry={() => void loaded.refresh()} skeleton={<SettingsSkeleton />}>
      {saved && <GiftOptionsForm key={JSON.stringify(saved)} data={saved} onSaved={loaded.setData} />}
    </DataState>
  );
}

function GiftOptionsForm({ data, onSaved }: { data: GiftOptionsSettings; onSaved: (next: GiftOptionsSettings) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const products = useStoreProducts();
  const [enabled, setEnabled] = useState(data.enabled);
  const [wrapVariantId, setWrapVariantId] = useState(data.wrapVariantId ?? "");
  const [length, setLength] = useState(String(data.messageMaxLength));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalog = useMemo(() => products.data ?? [], [products.data]);
  const wrap = useMemo(() => {
    for (const product of catalog) {
      const variant = product.variants?.find((v) => v.id === wrapVariantId);
      if (variant) return { product, variant };
    }
    return null;
  }, [catalog, wrapVariantId]);
  const wrapOnSale = wrap ? wrap.product.status === "active" && wrap.variant.status === "active" : false;
  const max = Number(length);
  const lengthValid = Number.isInteger(max) && max >= GIFT_MESSAGE_MIN_LENGTH && max <= GIFT_MESSAGE_MAX_LENGTH;
  const dirty = enabled !== data.enabled || (wrapVariantId || null) !== data.wrapVariantId || length !== String(data.messageMaxLength);
  const bounds = { min: GIFT_MESSAGE_MIN_LENGTH, max: GIFT_MESSAGE_MAX_LENGTH };

  async function save() {
    if (!lengthValid) {
      setError(fmt(t.messageLengthInvalid, bounds));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await giftOptionsSave(apiClient, workspaceId, { enabled, wrapVariantId: wrapVariantId || null, messageMaxLength: max });
      toast.success(t.saved);
      onSaved(next);
    } catch (err) {
      setError(isGiftWrapRefused(err) ? t.wrapRefused : errorMessage(err));
      setSaving(false);
    }
  }

  function reset() {
    setEnabled(data.enabled);
    setWrapVariantId(data.wrapVariantId ?? "");
    setLength(String(data.messageMaxLength));
    setError(null);
  }

  const option = (product: Product, variant: Variant) => {
    const options = formatOptions(variant.optionValues);
    const label = (product.variants?.length ?? 0) > 1 && options ? options : product.name;
    return `${label} — ${formatMoney(variant.priceAmount, variant.currency)}`;
  };

  return (
    <div className={STACK}>
      <SettingsGroup description={t.description}>
        <SettingsSwitch label={t.enabled} hint={t.enabledHint} checked={enabled} disabled={saving} onChange={setEnabled} />
        <SelectRow
          label={t.wrap}
          hint={t.wrapHint}
          stacked
          value={wrapVariantId}
          disabled={saving || products.loading}
          onChange={(e) => setWrapVariantId(e.target.value)}
        >
          <option value="">{t.wrapNone}</option>
          {/* Keep the saved wrap selectable while the list loads or when it is past the first 200 products. */}
          {wrapVariantId && !wrap && <option value={wrapVariantId}>{t.wrap}</option>}
          {catalog.map((product) => {
            const list = product.variants ?? [];
            if (list.length === 0) return null;
            return list.length > 1 ? (
              <optgroup key={product.id} label={product.name}>
                {list.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {option(product, variant)}
                  </option>
                ))}
              </optgroup>
            ) : (
              <option key={product.id} value={list[0].id}>
                {option(product, list[0])}
              </option>
            );
          })}
        </SelectRow>
        {wrap && !wrapOnSale && (
          <GroupBlock>
            <p className="text-[13px] leading-5 font-medium text-accent-dark">{t.wrapOff}</p>
          </GroupBlock>
        )}
        {!wrapVariantId && <SettingsLinkRow to="/catalog/new" label={t.wrapCreate} icon={IconGift} tone="pink" />}
        <InputRow
          label={t.messageLength}
          hint={fmt(t.messageLengthHint, bounds)}
          error={lengthValid ? undefined : fmt(t.messageLengthInvalid, bounds)}
          type="number"
          inputMode="numeric"
          min={GIFT_MESSAGE_MIN_LENGTH}
          max={GIFT_MESSAGE_MAX_LENGTH}
          dir="ltr"
          value={length}
          disabled={saving}
          onChange={(e) => setLength(e.target.value)}
        />
      </SettingsGroup>

      {/* A still picture of the checkout's gift block, in this store's words. */}
      <SettingsGroup title={t.preview}>
        <GroupBlock className={enabled ? "" : "opacity-60"}>
          <div className="mx-auto max-w-sm space-y-2.5 py-1 text-sm">
            <p className="flex items-center gap-2 font-medium text-ink">
              <span aria-hidden className="inline-block size-4 rounded border-2 border-primary bg-primary" />
              <IconGift className="size-4 text-primary" aria-hidden />
              {t.previewGift}
            </p>
            {wrap && wrapOnSale && (
              <p className="flex items-center gap-2 text-ink">
                <span aria-hidden className="inline-block size-4 rounded border-2 border-line-strong" />
                {fmt(t.previewWrap, { price: formatMoney(wrap.variant.priceAmount, wrap.variant.currency) })}
              </p>
            )}
            <div>
              <p className="mb-1 text-xs text-ink-soft">{t.previewMessage}</p>
              <div className="h-12 rounded-[var(--radius)] border border-line-strong bg-paper-raised" />
              <p className="mt-1 text-end text-xs text-ink-soft">{fmt(t.previewCounter, { max: lengthValid ? max : data.messageMaxLength })}</p>
            </div>
            <p className="flex items-center gap-2 text-ink">
              <span aria-hidden className="inline-block size-4 rounded border-2 border-primary bg-primary" />
              {t.previewHide}
            </p>
          </div>
        </GroupBlock>
      </SettingsGroup>

      <SettingsFormFooter editable dirty={dirty} saving={saving} error={error} onSave={() => void save()} onReset={reset} />
    </div>
  );
}
