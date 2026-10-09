import { useId, useMemo, useState } from "react";
import { Alert } from "@store-builder/ui";
import { ApiError, apiErrorCode, type OrderBumpSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { OfferPicker } from "@/components/OfferPicker";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { SettingsCard } from "./sections/SettingsCard";

/** Same roles as the other storefront cards: the PATCH needs website.edit. */
const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "editor"]);

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 240;

const STRINGS = {
  en: {
    title: "Checkout add-on offer",
    description:
      "One of your offers, shown as an “Add to your order” tick box above the order button on product pages and at checkout. Ticked, it joins the same order: one confirmation, one shipment, and its price, weight and shipping counted with the rest.",
    enabled: "Offer an add-on at checkout",
    enabledHint: "It is hidden while its offer is out of stock, and not shown on its own product's page or when that product is already in the cart.",
    offer: "The offer",
    offerHint: "Only an offer with a set price whose product asks the customer nothing can be used.",
    heading: "Heading (optional)",
    headingHint: "Replaces “Add to your order”.",
    text: "Short description (optional)",
    counter: "{count} / {max}",
    funnelsNote: "Sales funnels have their own add-on offer, chosen on each checkout step.",
    readOnly: "Only the store owner, a workspace manager or an editor can change the add-on offer.",
    chooseOffer: "Choose the offer to show.",
    rejected: "This offer can't be used as an add-on. Choose another one.",
    save: "Save add-on offer",
    saving: "Saving…",
    reset: "Discard changes",
    saved: "Add-on offer saved.",
  },
  ar: {
    title: "العرض الإضافي عند الدفع",
    description:
      "عرض من عروضك بيظهر كخانة «أضف لطلبك» فوق زرار الطلب في صفحات المنتجات وصفحة إتمام الطلب. لو العميل علّم عليه بيتضاف لنفس الأوردر: تأكيد واحد وشحنة واحدة، وسعره ووزنه وشحنه بيتحسبوا مع الباقي.",
    enabled: "اعرض إضافة مع الأوردر",
    enabledHint: "بيختفي لو مخزون العرض خلص، ومش بيظهر في صفحة منتجه ولا لو المنتج في السلة أصلًا.",
    offer: "العرض",
    offerHint: "ينفع بس عرض ليه سعر محدد ومنتجه مش بيطلب بيانات من العميل.",
    heading: "العنوان (اختياري)",
    headingHint: "بيتكتب بدل «أضف لطلبك».",
    text: "وصف قصير (اختياري)",
    counter: "{count} / {max}",
    funnelsNote: "مسارات البيع ليها عرض إضافي لوحدها، بيتختار من كل خطوة دفع.",
    readOnly: "صاحب المتجر أو المدير أو المحرر بس اللي يقدروا يغيّروا العرض الإضافي.",
    chooseOffer: "اختار العرض اللي هيظهر.",
    rejected: "العرض ده ما ينفعش يبقى عرض إضافي. اختار عرض تاني.",
    save: "احفظ العرض الإضافي",
    saving: "بنحفظ…",
    reset: "تجاهل",
    saved: "العرض الإضافي اتحفظ.",
  },
} satisfies Messages;

function readSettings(raw: unknown): Required<OrderBumpSettings> {
  const value = raw && typeof raw === "object" ? (raw as Partial<OrderBumpSettings>) : {};
  return {
    enabled: value.enabled === true,
    offer_id: typeof value.offer_id === "string" ? value.offer_id : null,
    title: typeof value.title === "string" ? value.title : "",
    description: typeof value.description === "string" ? value.description : "",
  };
}

export function OrderBumpSettingsSection() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace, applySavedWorkspace } = useWorkspace();
  const headingId = useId();
  const textId = useId();

  const stored = useMemo(() => readSettings(currentWorkspace?.settings?.order_bump), [currentWorkspace?.settings?.order_bump]);
  const [saved, setSaved] = useState(stored);
  const [draft, setDraft] = useState(stored);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useReportDirty(dirty && editable);
  const set = (patch: Partial<Required<OrderBumpSettings>>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };

  function reset() {
    setDraft(saved);
    setError(null);
  }

  async function save() {
    if (draft.enabled && !draft.offer_id) {
      setError(t.chooseOffer);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const workspace = await apiClient.updateWorkspace(workspaceId, {
        settings: {
          order_bump: {
            enabled: draft.enabled,
            offer_id: draft.offer_id,
            title: draft.title?.trim() || null,
            description: draft.description?.trim() || null,
          },
        },
      });
      const next = readSettings(workspace.settings?.order_bump);
      setSaved(next);
      setDraft(next);
      applySavedWorkspace(workspace);
      toast.success(t.saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        reset();
      } else if (apiErrorCode(err) === "VALIDATION_ERROR") {
        setError(t.rejected);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const counter = (value: string | null | undefined, max: number) =>
    t.counter.replace("{count}", String((value ?? "").length)).replace("{max}", String(max));

  return (
    <>
      {!editable && <Alert>{t.readOnly}</Alert>}

      <SettingsGroup footer={t.description}>
        <SettingsSwitch
          label={t.enabled}
          hint={t.enabledHint}
          checked={draft.enabled}
          disabled={!editable || saving}
          onChange={(enabled) => set({ enabled })}
        />
      </SettingsGroup>

      <SettingsCard>
        <fieldset className="space-y-4" disabled={!editable || saving}>
          <OfferPicker
            workspaceId={workspaceId}
            value={draft.offer_id}
            onChange={(offerId) => set({ offer_id: offerId })}
            disabled={!editable || saving}
            label={t.offer}
            hint={t.offerHint}
          />

          <div className="space-y-1.5">
            <label htmlFor={headingId} className="text-sm font-medium text-ink">
              {t.heading}
            </label>
            <input
              id={headingId}
              value={draft.title ?? ""}
              maxLength={TITLE_MAX}
              dir="auto"
              onChange={(e) => set({ title: e.target.value })}
              aria-describedby={`${headingId}-hint`}
              className="flex w-full rounded-[0.875rem] border border-line-strong bg-paper-raised px-3 text-base text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 sm:text-sm h-11"
            />
            <p id={`${headingId}-hint`} className="flex justify-between gap-3 text-xs text-ink-soft">
              <span>{t.headingHint}</span>
              <span className="tabular-nums">{counter(draft.title, TITLE_MAX)}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={textId} className="text-sm font-medium text-ink">
              {t.text}
            </label>
            <textarea
              id={textId}
              value={draft.description ?? ""}
              maxLength={DESCRIPTION_MAX}
              rows={2}
              dir="auto"
              onChange={(e) => set({ description: e.target.value })}
              aria-describedby={`${textId}-hint`}
              className="flex w-full rounded-[0.875rem] border border-line-strong bg-paper-raised px-3 text-base text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 sm:text-sm py-2"
            />
            <p id={`${textId}-hint`} className="text-end text-xs text-ink-soft tabular-nums">
              {counter(draft.description, DESCRIPTION_MAX)}
            </p>
          </div>
        </fieldset>

        <p className="mt-4 text-[13px] leading-5 text-ink-soft">{t.funnelsNote}</p>
      </SettingsCard>

      {error && <Alert variant="danger">{error}</Alert>}

      {editable && (
        <SaveBar
          dirty={dirty}
          saving={saving}
          saveLabel={t.save}
          savingLabel={t.saving}
          discardLabel={t.reset}
          onSave={() => void save()}
          onDiscard={reset}
        />
      )}
    </>
  );
}
