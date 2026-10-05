import { useState } from "react";
import { Share2 } from "lucide-react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import {
  funnelExtrasImport,
  funnelExtrasShare,
  funnelsDuplicate,
  funnelExtrasUnshare,
  funnelsListSteps,
  funnelsUpdateStep,
  type FunnelDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { CopyButton } from "@/components/CopyButton";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { AI_FUNNEL_DEFAULTS, AiFunnelFields, AiTemplateCard, createAiFunnel, useAiFunnelText, type AiFunnelSettings } from "./AiFunnelOption";
import { useAiErrorText } from "@/lib/aiRun";
import { AI_ENABLED } from "@/lib/features";
import { useToast } from "@/components/Toast";
import { createFunnelFromStarter, useFunnelErrorMessage, type StarterTemplateId } from "./funnelAdapter";
import { FunnelTemplateGallery, type GalleryPick } from "./FunnelTemplateGallery";

/**
 * Creating a funnel in three steps (SPEC §9.1): the template, what it is for
 * and which product it sells, then its name and link. The other way in is a
 * share code another merchant gave you. `FunnelShareDialog` is where a
 * merchant gets that code for one of their own funnels.
 *
 * The templates are the editor's own starters — nothing here invents a
 * gallery, prices or usage counts that the backend does not have.
 */

const STRINGS = {
  en: {
    step1: "Template",
    step2: "Goal and product",
    step3: "Name and link",
    fromTemplate: "Start from a template",
    fromCode: "Copy a funnel by code",
    code: "Share code",
    codeHint: "The code a merchant gave you. You get the funnel's pages and links, without their products or orders.",
    importIt: "Copy the funnel",
    importing: "Copying…",
    imported: "\"{name}\" copied — {steps} pages. Choose your products before publishing.",
    goal: "What is this funnel for?",
    goalSell: "Sell a product",
    goalSellHint: "Product page, checkout and thank-you.",
    goalLeads: "Collect leads",
    goalLeadsHint: "A form that collects names and numbers.",
    product: "Product",
    productHint: "The funnel's pages follow this product. You can change it later, page by page.",
    productNewest: "The store's newest product",
    name: "Funnel name",
    namePlaceholder: "Headphones Pro offer — Ramadan",
    nameRequired: "Give the funnel a name.",
    currency: "Currency",
    currencyHint: "The funnel sells in this currency: its products and offers must be priced in it before you publish.",
    storeCurrency: "{code} (the store's)",
    link: "Link",
    linkHint: "Letters, numbers and hyphens. Leave empty and one is made from the name.",
    linkInvalid: "Use 3–63 lowercase letters, numbers and hyphens.",
    back: "Back",
    next: "Next",
    cancel: "Cancel",
    create: "Create and open editor",
    creating: "Creating…",
    created: "\"{name}\" created.",
    createdPartial: "The funnel was created but its starter pages couldn't all be added: {message}",
    shareTitle: "Share this funnel",
    shareDescription: "Give this code to another merchant. They get a copy of the funnel's pages and links — not your products, offers or orders.",
    shareStop: "Stop sharing",
    shareStopped: "Sharing stopped. The old code no longer works.",
    copy: "Copy code",
    close: "Close",
  },
  ar: {
    step1: "القالب",
    step2: "الهدف والمنتج",
    step3: "الاسم والرابط",
    fromTemplate: "ابدأ من قالب",
    fromCode: "نسخ مسار بيع بكود",
    code: "كود المشاركة",
    codeHint: "الكود الذي أعطاه لك تاجر آخر. تحصل على صفحات المسار وروابطه بدون منتجاته أو طلباته.",
    importIt: "نسخ المسار",
    importing: "جارٍ النسخ…",
    imported: "تم نسخ «{name}» — {steps} صفحات. اختر منتجاتك قبل النشر.",
    goal: "ما هدف هذا المسار؟",
    goalSell: "بيع منتج",
    goalSellHint: "صفحة منتج ثم الدفع ثم الشكر.",
    goalLeads: "جمع بيانات عملاء",
    goalLeadsHint: "نموذج يجمع الأسماء والأرقام.",
    product: "المنتج",
    productHint: "صفحات المسار تتبع هذا المنتج. يمكنك تغييره لاحقًا لكل صفحة.",
    productNewest: "أحدث منتج في المتجر",
    name: "اسم مسار البيع",
    namePlaceholder: "عرض السماعة Pro — رمضان",
    nameRequired: "اكتب اسمًا لمسار البيع.",
    currency: "العملة",
    currencyHint: "الفانل بيبيع بالعملة دي: لازم منتجاته وعروضه تكون متسعّرة بيها قبل النشر.",
    storeCurrency: "{code} (عملة المتجر)",
    link: "الرابط",
    linkHint: "حروف وأرقام وشرطات. اتركه فارغًا ليُصنع من الاسم.",
    linkInvalid: "استخدم من 3 إلى 63 حرفًا صغيرًا وأرقامًا وشرطات.",
    back: "رجوع",
    next: "التالي",
    cancel: "إلغاء",
    create: "إنشاء وفتح المحرر",
    creating: "جارٍ الإنشاء…",
    created: "تم إنشاء «{name}».",
    createdPartial: "تم إنشاء مسار البيع لكن تعذّرت إضافة كل الصفحات المبدئية: {message}",
    shareTitle: "مشاركة مسار البيع",
    shareDescription: "أعطِ هذا الكود لتاجر آخر. يحصل على نسخة من صفحات المسار وروابطه — بدون منتجاتك أو عروضك أو طلباتك.",
    shareStop: "إيقاف المشاركة",
    shareStopped: "تم إيقاف المشاركة. الكود القديم لم يعد يعمل.",
    copy: "نسخ الكود",
    close: "إغلاق",
  },
} satisfies Messages;

type Goal = "sell" | "leads";
const LINK = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

function partialIdOf(err: unknown): string | null {
  const id = (err as { partialFunnelId?: unknown } | null)?.partialFunnelId;
  return typeof id === "string" ? id : null;
}

export function FunnelWizard({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();

  const [mode, setMode] = useState<"template" | "code">("template");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState<Goal>("sell");
  const [templateId, setTemplateId] = useState<StarterTemplateId>("blank");
  // Which language version of the starter, and a funnel of the store's to copy instead (FunnelTemplateGallery).
  const [templateLang, setTemplateLang] = useState(locale);
  const [copyFrom, setCopyFrom] = useState<{ funnelId: string; name: string } | null>(null);
  const [productId, setProductId] = useState("");
  // The "AI template" card (AiFunnelOption.tsx): the AI writes the sales page. Only while AI is switched on.
  const [ai, setAi] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiFunnelSettings>(AI_FUNNEL_DEFAULTS);
  const aiText = useAiFunnelText();
  const aiError = useAiErrorText();
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = useAsync(
    () =>
      apiClient
        .listProducts(workspaceId, { status: "active", limit: 100 })
        .then((r) => r.products)
        .catch(() => []),
    [workspaceId]
  );

  async function importByCode() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await funnelExtrasImport(apiClient, workspaceId, { shareCode: code.trim() });
      toast.success(fmt(t.imported, { name: result.funnel.name, steps: result.stepCount }));
      onCreated(result.funnel.id);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  async function create() {
    if (!name.trim()) return setError(t.nameRequired);
    const subdomain = link.trim().toLowerCase();
    if (subdomain && !LINK.test(subdomain)) return setError(t.linkInvalid);
    setBusy(true);
    setError(null);
    if (copyFrom) {
      try {
        const copy = await funnelsDuplicate(apiClient, workspaceId, copyFrom.funnelId, { name: name.trim(), ...(subdomain ? { subdomain } : {}) });
        toast.success(fmt(t.created, { name: copy.name }));
        return onCreated(copy.id);
      } catch (err) {
        setError(describeError(err));
        return setBusy(false);
      }
    }
    if (AI_ENABLED && ai) {
      try {
        const id = await createAiFunnel(workspaceId, { productId, name: name.trim(), subdomain: subdomain || undefined, settings: aiSettings });
        toast.success(fmt(t.created, { name: name.trim() }));
        return onCreated(id);
      } catch (err) {
        setError(aiError(err));
        return setBusy(false);
      }
    }
    let funnel: FunnelDto;
    try {
      funnel = await createFunnelFromStarter(workspaceId, name.trim(), templateId, templateLang, subdomain || undefined);
    } catch (err) {
      const partial = partialIdOf(err);
      if (partial) {
        toast.error(fmt(t.createdPartial, { message: describeError(err) }));
        return onCreated(partial);
      }
      setError(describeError(err));
      return setBusy(false);
    }
    // The product is a finishing touch: a failure here still leaves a usable
    // funnel, so the merchant is taken to it either way.
    try {
      if (productId && goal === "sell") {
        for (const s of await funnelsListSteps(apiClient, workspaceId, funnel.id)) {
          const tree = s.builderData && typeof s.builderData === "object" ? (s.builderData as Record<string, unknown>) : null;
          if (!tree || !Array.isArray(tree.sections) || tree.sections.length === 0) continue;
          await funnelsUpdateStep(apiClient, workspaceId, funnel.id, s.id, { builderData: { ...tree, productId } });
        }
      }
      toast.success(fmt(t.created, { name: funnel.name }));
    } catch (err) {
      toast.error(describeError(err));
    }
    onCreated(funnel.id);
  }

  const tab = (value: "template" | "code", label: string) => (
    <button
      type="button"
      aria-pressed={mode === value}
      onClick={() => {
        setMode(value);
        setError(null);
      }}
      className={cn(
        "cursor-pointer rounded-[0.375rem] px-3 py-1.5 text-sm font-medium",
        mode === value ? "bg-primary-soft text-primary-dark dark:text-primary" : "text-ink-soft hover:text-ink"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex gap-1 rounded-[0.5rem] border border-line bg-paper-raised p-1">
        {tab("template", t.fromTemplate)}
        {tab("code", t.fromCode)}
      </div>

      {mode === "code" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="funnel-share-code">{t.code}</Label>
            <Input
              id="funnel-share-code"
              dir="ltr"
              maxLength={20}
              value={code}
              disabled={busy}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoFocus
            />
            <p className="text-xs text-ink-soft">{t.codeHint}</p>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              {t.cancel}
            </Button>
            <Button type="button" onClick={() => void importByCode()} disabled={busy || code.trim().length < 6}>
              {busy ? t.importing : t.importIt}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
            {([t.step1, t.step2, t.step3] as const).map((label, i) => (
              <li key={label} className={cn(step === i + 1 ? "text-primary" : "text-ink-soft")} aria-current={step === i + 1 ? "step" : undefined}>
                {i + 1}. {label}
              </li>
            ))}
          </ol>

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-ink">{t.goal}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["sell", t.goalSell, t.goalSellHint],
                    ["leads", t.goalLeads, t.goalLeadsHint],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className={cn(
                      "cursor-pointer rounded-2xl border p-3",
                      goal === value ? "border-primary bg-primary-soft ring-1 ring-primary/30" : "border-line hover:border-primary/50"
                    )}
                  >
                    <input
                      type="radio"
                      name="funnel-goal"
                      className="sr-only"
                      checked={goal === value}
                      onChange={() => {
                        setGoal(value);
                        setTemplateId("blank");
                        setCopyFrom(null);
                        setAi(false);
                      }}
                    />
                    <p className="text-sm font-semibold text-ink">{label}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>
                  </label>
                ))}
              </div>
              <FunnelTemplateGallery
                goal={goal}
                locale={locale}
                value={ai ? null : copyFrom ? { kind: "copy", ...copyFrom } : { kind: "starter", id: templateId, lang: templateLang }}
                onChange={(pick: GalleryPick) => {
                  setAi(false);
                  if (pick.kind === "copy") return setCopyFrom({ funnelId: pick.funnelId, name: pick.name });
                  setCopyFrom(null);
                  setTemplateId(pick.id);
                  setTemplateLang(pick.lang);
                }}
                leading={AI_ENABLED && goal === "sell" ? <AiTemplateCard active={ai} onSelect={() => { setAi(true); setCopyFrom(null); }} /> : null}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-1.5">
              <Label htmlFor="funnel-product">{t.product}</Label>
              <Select id="funnel-product" value={productId} disabled={goal === "leads"} onChange={(e) => setProductId(e.target.value)}>
                <option value="">{t.productNewest}</option>
                {(products.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-ink-soft">{goal === "leads" ? t.goalLeadsHint : t.productHint}</p>
              {AI_ENABLED && ai && (
                <div className="pt-2">
                  <AiFunnelFields value={aiSettings} onChange={setAiSettings} />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="funnel-name">{t.name}</Label>
                <Input id="funnel-name" dir="auto" maxLength={200} value={name} placeholder={t.namePlaceholder} disabled={busy} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="funnel-link">{t.link}</Label>
                <Input id="funnel-link" dir="ltr" maxLength={63} value={link} disabled={busy} onChange={(e) => setLink(e.target.value)} />
                <p className="text-xs text-ink-soft">{t.linkHint}</p>
              </div>
            </div>
          )}

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="flex justify-between gap-3 pt-1">
            <Button type="button" variant="outline" onClick={step === 1 ? onCancel : () => setStep((s) => (s - 1) as 1 | 2)} disabled={busy}>
              {step === 1 ? t.cancel : t.back}
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                onClick={() => {
                  setError(null);
                  if (step === 2 && AI_ENABLED && ai && !productId) return setError(aiText.needsProduct);
                  setStep((s) => (s + 1) as 2 | 3);
                }}
              >
                {t.next}
              </Button>
            ) : (
              <Button type="button" onClick={() => void create()} disabled={busy}>
                {busy ? t.creating : t.create}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** The row button that opens the share dialog, with its own label in both languages. */
export function ShareFunnelButton({ onClick }: { onClick: () => void }) {
  const { locale } = useLocale();
  const label = locale === "ar" ? "مشاركة بكود" : "Share by code";
  return (
    <Button size="icon-sm" variant="ghost" title={label} aria-label={label} onClick={onClick}>
      <Share2 className="size-4" aria-hidden />
    </Button>
  );
}

/** Shows (creating it on first open) the share code of one funnel, with copy and stop. */
export function FunnelShareDialog({ funnel, onClose }: { funnel: FunnelDto | null; onClose: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const code = useAsync(
    () => (funnel ? funnelExtrasShare(apiClient, workspaceId, funnel.id) : Promise.resolve(null)),
    [workspaceId, funnel?.id]
  );

  return (
    <Modal open={funnel !== null} onClose={onClose} title={t.shareTitle} description={t.shareDescription}>
      <div className="space-y-4">
        {code.error ? (
          <Alert variant="danger">{describeError(code.error)}</Alert>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <bdi dir="ltr" className="rounded-[0.5rem] border border-line bg-paper px-4 py-2 font-mono text-lg tracking-widest text-ink">
              {code.loading ? "…" : (code.data ?? "—")}
            </bdi>
            {code.data && <CopyButton value={code.data} label={t.copy} />}
          </div>
        )}
        <div className="flex justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={!code.data}
            onClick={async () => {
              if (!funnel) return;
              try {
                await funnelExtrasUnshare(apiClient, workspaceId, funnel.id);
                toast.success(t.shareStopped);
                onClose();
              } catch (err) {
                toast.error(describeError(err));
              }
            }}
          >
            {t.shareStop}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.close}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
