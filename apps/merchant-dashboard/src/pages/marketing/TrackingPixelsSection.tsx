import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Radio, Send, Trash2 } from "lucide-react";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  GOOGLE_ADS_LABEL,
  PINTEREST_AD_ACCOUNT_ID,
  funnelsList,
  googleAdsLabelsOf,
  googleAdsPixelConfig,
  pinterestAdAccountIdOf,
  pinterestPixelConfig,
  trackingPixelsCreate,
  trackingPixelsDelete,
  trackingPixelsList,
  trackingPixelsSendTest,
  trackingPixelsUpdate,
  type TrackingPixelDto,
  type TrackingPixelPlatform,
  type TrackingPixelPlatformInfo,
  type TrackingPixelScopeType,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatRelativeTime } from "@/lib/relativeTime";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { PinterestCapiFields } from "./PinterestCapiFields";
import { GtmContainerCard } from "./GtmContainerCard";

/**
 * What each platform's ID looks like. The patterns are the backend's
 * (trackingPixelService.PLATFORMS), so a bad ID is caught before the request.
 */
const PLATFORM_META: Record<TrackingPixelPlatform, { name: string; pattern: RegExp; example: string }> = {
  meta: { name: "Meta (Facebook & Instagram)", pattern: /^\d{5,20}$/, example: "123456789012345" },
  tiktok: { name: "TikTok", pattern: /^[A-Z0-9]{10,30}$/, example: "C4ABCDEF1234567890" },
  snapchat: { name: "Snapchat", pattern: /^[a-f0-9-]{20,40}$/i, example: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d" },
  google: { name: "Google (GA4 / Ads)", pattern: /^(G|AW|GT)-[A-Z0-9]{4,20}$/, example: "G-ABC123XYZ" },
  gtm: { name: "Google Tag Manager", pattern: /^GTM-[A-Z0-9]{4,12}$/, example: "GTM-ABC1234" },
  clarity: { name: "Microsoft Clarity", pattern: /^[a-z0-9]{6,20}$/, example: "abcd1234ef" },
  pinterest: { name: "Pinterest", pattern: /^\d{10,16}$/, example: "2612345678901" },
};

const STRINGS = {
  en: {
    title: "Pixels and tags",
    description:
      "Add as many pixels as you need per platform. Each one can cover the whole store, or only some funnels or products.",
    add: "Add pixel",
    emptyTitle: "No pixels yet",
    emptyBody: "Add your first pixel so your ad platforms can see visits and orders from this store.",
    capiWarning:
      "If you are not sure what the Conversions API is, leave it off. Turning it on while the same pixel is also connected somewhere else can count every order twice.",
    eventsNote:
      "Your store sends the standard events on its own: page view, product view, add to cart, checkout started, and purchase with the real order total.",
    colPlatform: "Platform",
    colId: "ID",
    colCapi: "Server events",
    colScope: "Applies to",
    colStatus: "Status",
    capiOn: "On",
    capiOff: "Off",
    capiNone: "Browser only",
    capiError: "Last send failed: {error}",
    capiLast: "Last sent {when}",
    scopeAll: "Whole store",
    scopeFunnels: "{n} funnel(s)",
    scopeProducts: "{n} product(s)",
    active: "Active",
    paused: "Paused",
    edit: "Edit",
    delete: "Delete",
    pause: "Pause",
    resume: "Resume",
    addTitle: "Add a pixel",
    editTitle: "Edit pixel",
    platform: "Platform",
    pixelId: "Pixel / tag ID",
    invalid: "That doesn't look like a valid ID for this platform.",
    label: "Note",
    labelHint: "Only you see this — e.g. the ad account it belongs to.",
    capiEnabled: "Also send orders from the server (Conversions API)",
    capiToken: "Access token",
    capiTokenKeep: "A token is saved ({mask}). Leave empty to keep it.",
    capiTokenGa4: "For GA4 this is the Measurement Protocol API secret.",
    capiTokenRequired: "Paste the token to turn server events on.",
    testCode: "Test event code",
    testCodeHint: "Optional. While set, server events show up under Test events instead of counting as real ones.",
    adsLabel: "Purchase conversion label",
    adsLabelHint: "Google Ads → Goals → Conversions → your action → Tag setup → the part after the slash in send_to",
    adsLeadLabel: "Lead conversion label",
    adsLeadLabelHint: "Used when the store or a funnel reports orders as Lead.",
    adsLabelInvalid: "Use 4 to 60 letters, digits, - or _.",
    adsLabelNeedsAds: "A conversion label needs a Google Ads id (AW-…)",
    scope: "Applies to",
    chooseFunnels: "Choose funnels",
    chooseProducts: "Choose products",
    scopeEmpty: "Nothing to choose from yet.",
    scopeRequired: "Choose at least one.",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    created: "Pixel added. It is live on your store now.",
    updated: "Pixel saved.",
    deleted: "Pixel removed.",
    deleteTitle: "Remove this pixel?",
    deleteBody: "{name} {id} will stop receiving events from your store.",
    deleting: "Removing…",
    test: "Send test event",
    testOk: "Test event accepted by {name}.",
    testOkCode: "Test event accepted — look under Test events in {name}.",
    testFailed: "{name} refused the test event: {error}",
  },
  ar: {
    title: "البيكسلات والأكواد",
    description: "أضف أي عدد من البيكسلات لكل منصة. كل بيكسل يمكن أن يعمل على المتجر كله أو على قموع أو منتجات محددة فقط.",
    add: "إضافة بيكسل",
    emptyTitle: "لا توجد بيكسلات بعد",
    emptyBody: "أضف أول بيكسل لتتمكن منصات الإعلانات من رؤية زيارات وطلبات متجرك.",
    capiWarning:
      "إذا لم تكن تعرف ما هو الـ Conversions API فاتركه مغلقًا. تشغيله والبيكسل نفسه مربوط في مكان آخر قد يحسب كل طلب مرتين.",
    eventsNote:
      "متجرك يرسل الأحداث المعروفة تلقائيًا: فتح صفحة، مشاهدة منتج، إضافة للسلة، بدء الطلب، والشراء بقيمة الطلب الحقيقية.",
    colPlatform: "المنصة",
    colId: "المعرّف",
    colCapi: "أحداث السيرفر",
    colScope: "يعمل على",
    colStatus: "الحالة",
    capiOn: "مفعّل",
    capiOff: "مغلق",
    capiNone: "المتصفح فقط",
    capiError: "فشل آخر إرسال: {error}",
    capiLast: "آخر إرسال {when}",
    scopeAll: "المتجر كله",
    scopeFunnels: "{n} قمع",
    scopeProducts: "{n} منتج",
    active: "يعمل",
    paused: "متوقف",
    edit: "تعديل",
    delete: "حذف",
    pause: "إيقاف",
    resume: "تشغيل",
    addTitle: "إضافة بيكسل",
    editTitle: "تعديل البيكسل",
    platform: "المنصة",
    pixelId: "معرّف البيكسل / الكود",
    invalid: "هذا المعرّف لا يبدو صحيحًا لهذه المنصة.",
    label: "ملاحظة",
    labelHint: "تظهر لك فقط — مثل الحساب الإعلاني التابع له.",
    capiEnabled: "إرسال الطلبات من السيرفر أيضًا (Conversions API)",
    capiToken: "رمز الوصول (Access token)",
    capiTokenKeep: "يوجد رمز محفوظ ({mask}). اتركه فارغًا للإبقاء عليه.",
    capiTokenGa4: "في GA4 هذا هو الـ API secret الخاص بـ Measurement Protocol.",
    capiTokenRequired: "الصق الرمز لتفعيل أحداث السيرفر.",
    testCode: "كود الأحداث التجريبية",
    testCodeHint: "اختياري. طالما هو موجود تظهر أحداث السيرفر في Test events ولا تُحسب كأحداث حقيقية.",
    adsLabel: "ليبل تحويل الشراء",
    adsLabelHint: "في Google Ads افتح الأهداف ← التحويلات ← الإجراء بتاعك ← إعداد العلامة، وانسخ الجزء اللي بعد الـ / في send_to.",
    adsLeadLabel: "ليبل تحويل العميل المحتمل",
    adsLeadLabelHint: "بيتستخدم لما المتجر أو قمع يسجّل الطلبات كـ Lead.",
    adsLabelInvalid: "اكتب من 4 لـ 60 حرف إنجليزي أو رقم، ومسموح بالشرطة (-) والشرطة السفلية (_).",
    adsLabelNeedsAds: "الليبل محتاج رقم إعلانات جوجل (AW-…)",
    scope: "يعمل على",
    chooseFunnels: "اختر القموع",
    chooseProducts: "اختر المنتجات",
    scopeEmpty: "لا يوجد ما تختار منه بعد.",
    scopeRequired: "اختر واحدًا على الأقل.",
    save: "حفظ",
    saving: "بنحفظ…",
    cancel: "إلغاء",
    created: "تمت إضافة البيكسل وهو يعمل على متجرك الآن.",
    updated: "تم حفظ البيكسل.",
    deleted: "تم حذف البيكسل.",
    deleteTitle: "حذف هذا البيكسل؟",
    deleteBody: "سيتوقف {name} {id} عن استقبال الأحداث من متجرك.",
    deleting: "بنمسح…",
    test: "إرسال حدث تجريبي",
    testOk: "{name} قبل الحدث التجريبي.",
    testOkCode: "تم قبول الحدث التجريبي — ستجده في Test events داخل {name}.",
    testFailed: "{name} رفض الحدث التجريبي: {error}",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

interface FormState {
  platform: TrackingPixelPlatform;
  pixelId: string;
  label: string;
  capiEnabled: boolean;
  capiToken: string;
  testEventCode: string;
  adsConversionLabel: string;
  /** The Google Ads lead conversion label (config.adsLeadLabel, handoff 169). */
  adsLeadLabel: string;
  /** Pinterest's Conversions API needs the ad account (config.adAccountId). */
  adAccountId: string;
  scopeType: TrackingPixelScopeType;
  scopeIds: string[];
}

const emptyForm = (): FormState => ({
  platform: "meta",
  pixelId: "",
  label: "",
  capiEnabled: false,
  capiToken: "",
  testEventCode: "",
  adsConversionLabel: "",
  adsLeadLabel: "",
  adAccountId: "",
  scopeType: "all",
  scopeIds: [],
});

const formOf = (p: TrackingPixelDto): FormState => ({
  platform: p.platform,
  pixelId: p.pixelId,
  label: p.label ?? "",
  capiEnabled: p.capiEnabled,
  capiToken: "",
  testEventCode: p.testEventCode ?? "",
  adsConversionLabel: googleAdsLabelsOf(p).purchase,
  adsLeadLabel: googleAdsLabelsOf(p).lead,
  adAccountId: pinterestAdAccountIdOf(p),
  scopeType: p.scope.type,
  scopeIds: p.scope.ids,
});

/** Marketing → Tracking tools: the store's pixels and tags. */
export function TrackingPixelsSection({ onEventsChanged }: { onEventsChanged?: () => void } = {}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const { data, error, loading, refresh } = useAsync(() => trackingPixelsList(apiClient, workspaceId), [workspaceId]);
  const [editing, setEditing] = useState<TrackingPixelDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<TrackingPixelDto | null>(null);

  async function toggleActive(pixel: TrackingPixelDto) {
    try {
      await trackingPixelsUpdate(apiClient, workspaceId, pixel.id, { isActive: !pixel.isActive });
      await refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const [testing, setTesting] = useState<string | null>(null);

  async function sendTest(pixel: TrackingPixelDto) {
    const name = PLATFORM_META[pixel.platform]?.name ?? pixel.platform;
    setTesting(pixel.id);
    try {
      const result = await trackingPixelsSendTest(apiClient, workspaceId, pixel.id);
      if (result.ok) toast.success(fmt(result.usedTestCode ? t.testOkCode : t.testOk, { name }));
      else toast.error(fmt(t.testFailed, { name, error: result.error ?? "" }));
      await refresh({ silent: true });
      onEventsChanged?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTesting(null);
    }
  }

  const columns: Column<TrackingPixelDto>[] = [
    {
      key: "platform",
      header: t.colPlatform,
      cell: (p) => (
        <div>
          <div className="font-medium text-ink">{PLATFORM_META[p.platform]?.name ?? p.platform}</div>
          {p.label && <div className="text-xs text-ink-soft">{p.label}</div>}
        </div>
      ),
    },
    {
      key: "id",
      header: t.colId,
      cell: (p) => (
        <code dir="ltr" className="break-all font-mono text-xs text-ink">
          {p.pixelId}
        </code>
      ),
    },
    {
      key: "capi",
      header: t.colCapi,
      cell: (p) =>
        !p.capiSupported ? (
          <span className="text-xs text-ink-soft">{t.capiNone}</span>
        ) : (
          <div>
            <StatusBadge value={p.capiEnabled ? "on" : "off"} tone={p.capiEnabled ? (p.lastError ? "danger" : "success") : "neutral"} text={p.capiEnabled ? t.capiOn : t.capiOff} />
            {p.capiEnabled && p.lastError && (
              <div className="mt-1 max-w-56 text-xs text-danger">{fmt(t.capiError, { error: p.lastError })}</div>
            )}
            {p.capiEnabled && !p.lastError && p.lastSentAt && (
              <div className="mt-1 text-xs text-ink-soft">{fmt(t.capiLast, { when: formatRelativeTime(p.lastSentAt) })}</div>
            )}
          </div>
        ),
    },
    {
      key: "scope",
      header: t.colScope,
      cell: (p) =>
        p.scope.type === "all"
          ? t.scopeAll
          : fmt(p.scope.type === "funnels" ? t.scopeFunnels : t.scopeProducts, { n: p.scope.ids.length }),
    },
    {
      key: "status",
      header: t.colStatus,
      cell: (p) => <StatusBadge value={p.isActive ? "active" : "paused"} tone={p.isActive ? "success" : "neutral"} text={p.isActive ? t.active : t.paused} />,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (p) => (
        <div className="flex items-center justify-end gap-1">
          {p.capiEnabled && p.capiSupported && (
            <Button size="sm" variant="ghost" aria-label={t.test} title={t.test} disabled={testing === p.id} onClick={() => void sendTest(p)}>
              <Send className="size-4" aria-hidden />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void toggleActive(p)}>
            {p.isActive ? t.pause : t.resume}
          </Button>
          <Button size="sm" variant="ghost" aria-label={t.edit} onClick={() => setEditing(p)}>
            <Pencil className="size-4" aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" aria-label={t.delete} onClick={() => setDeleting(p)}>
            <Trash2 className="size-4 text-danger" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  const atLimit = Boolean(data && data.pixels.length >= data.limit);
  // A Google Tag Manager pixel gets the ready-made container card (handoff 170).
  const hasGtm = Boolean(data?.pixels.some((p) => p.platform === "gtm"));

  return (
    <>
      <Card className="mb-6 gap-0 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Radio className="size-4 text-primary" aria-hidden />
              {t.title}
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">{t.description}</p>
          </div>
          <Button size="sm" onClick={() => setEditing("new")} disabled={!data || atLimit}>
            <Plus className="size-4" aria-hidden />
            {t.add}
          </Button>
        </div>

        <Alert className="mt-3">{t.capiWarning}</Alert>

        <div className="mt-3">
          <DataState loading={loading} error={error} onRetry={() => void refresh()}>
            {data && data.pixels.length === 0 ? (
              <EmptyState
                icon={<Radio className="size-6" aria-hidden />}
                title={t.emptyTitle}
                description={t.emptyBody}
                action={<Button onClick={() => setEditing("new")}>{t.add}</Button>}
              />
            ) : (
              <DataTable columns={columns} rows={data?.pixels ?? []} rowKey={(p) => p.id} minWidth="44rem" />
            )}
          </DataState>
        </div>
        <p className="mt-3 text-xs text-ink-soft">{t.eventsNote}</p>

        {editing && data && (
          <PixelDialog
            key={editing === "new" ? "new" : editing.id}
            t={t}
            pixel={editing === "new" ? null : editing}
            platforms={data.platforms}
            onClose={() => setEditing(null)}
            onSaved={async (created) => {
              setEditing(null);
              toast.success(created ? t.created : t.updated);
              await refresh({ silent: true });
            }}
          />
        )}

        <ConfirmDialog
          open={Boolean(deleting)}
          title={t.deleteTitle}
          description={deleting ? fmt(t.deleteBody, { name: PLATFORM_META[deleting.platform]?.name ?? deleting.platform, id: deleting.pixelId }) : undefined}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          busyLabel={t.deleting}
          destructive
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            if (!deleting) return;
            await trackingPixelsDelete(apiClient, workspaceId, deleting.id);
            setDeleting(null);
            toast.success(t.deleted);
            await refresh({ silent: true });
          }}
        />
      </Card>
      {data && hasGtm && <GtmContainerCard pixels={data.pixels} />}
    </>
  );
}

function PixelDialog({
  t,
  pixel,
  platforms,
  onClose,
  onSaved,
}: {
  t: T;
  pixel: TrackingPixelDto | null;
  platforms: TrackingPixelPlatformInfo[];
  onClose: () => void;
  onSaved: (created: boolean) => Promise<void>;
}) {
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [form, setForm] = useState<FormState>(() => (pixel ? formOf(pixel) : emptyForm()));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const meta = PLATFORM_META[form.platform];
  const info = platforms.find((p) => p.name === form.platform);
  const id = form.pixelId.trim();
  const idBad = id !== "" && !meta.pattern.test(id);
  // GA4's server API only takes a G- id; an Ads id has a conversion label instead.
  const isAdsId = form.platform === "google" && /^AW-/i.test(id);
  const capiPossible = Boolean(info?.capi) && !(form.platform === "google" && id !== "" && !/^G-/i.test(id));
  const tokenSaved = Boolean(pixel?.capiTokenSet);
  const tokenMissing = form.capiEnabled && capiPossible && !tokenSaved && form.capiToken.trim() === "";
  const scopeMissing = form.scopeType !== "all" && form.scopeIds.length === 0;
  const pinterest = form.platform === "pinterest";
  const adAccount = form.adAccountId.trim();
  // Checked here before saving; the server's own refusal (config.adAccountId) shows the same words.
  const adAccountBad: "missing" | "invalid" | null = !pinterest
    ? null
    : adAccount !== "" && !PINTEREST_AD_ACCOUNT_ID.test(adAccount)
      ? "invalid"
      : form.capiEnabled && capiPossible && adAccount === ""
        ? "missing"
        : null;
  const adAccountProblem = adAccountBad ?? (fieldErrors["config.adAccountId"] ? "missing" : null);
  // Google Ads labels (handoff 169): checked here; the server refuses one on a non-Ads tag.
  const labelBad = (value: string) => isAdsId && value.trim() !== "" && !GOOGLE_ADS_LABEL.test(value.trim());
  const purchaseLabelBad = labelBad(form.adsConversionLabel);
  const leadLabelBad = labelBad(form.adsLeadLabel);
  const labelError = (bad: boolean, field: string) =>
    bad ? t.adsLabelInvalid : fieldErrors[field] ? (isAdsId ? t.adsLabelInvalid : t.adsLabelNeedsAds) : undefined;
  const setLabel = (key: "adsConversionLabel" | "adsLeadLabel", value: string) => {
    set(key, value);
    setFieldErrors((prev) => ({ ...prev, [`config.${key}`]: "" }));
  };

  // The scope lists load only when that scope is picked.
  const funnels = useAsync(
    async () => (form.scopeType === "funnels" ? (await funnelsList(apiClient, workspaceId)).map((f) => ({ id: f.id, name: f.name })) : []),
    [workspaceId, form.scopeType === "funnels"]
  );
  const products = useAsync(
    async () =>
      form.scopeType === "products"
        ? (await apiClient.listProducts(workspaceId, { limit: 100 })).products.map((p) => ({ id: p.id, name: p.name }))
        : [],
    [workspaceId, form.scopeType === "products"]
  );
  const options = form.scopeType === "funnels" ? funnels : form.scopeType === "products" ? products : null;

  const scopeIdSet = useMemo(() => new Set(form.scopeIds), [form.scopeIds]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (id === "" || idBad || tokenMissing || scopeMissing || adAccountBad || purchaseLabelBad || leadLabelBad) return;
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const token = form.capiToken.trim();
    const shared = {
      pixelId: id,
      label: form.label.trim() || null,
      capiEnabled: form.capiEnabled && capiPossible,
      testEventCode: info?.testEventCode ? form.testEventCode.trim() || null : undefined,
      scope: { type: form.scopeType, ids: form.scopeType === "all" ? [] : form.scopeIds },
      config:
        form.platform === "google"
          ? googleAdsPixelConfig(id, { purchase: form.adsConversionLabel, lead: form.adsLeadLabel })
          : pinterest
            ? pinterestPixelConfig(form.adAccountId)
            : undefined,
      ...(token ? { capiToken: token } : {}),
    };
    try {
      if (pixel) await trackingPixelsUpdate(apiClient, workspaceId, pixel.id, shared);
      else await trackingPixelsCreate(apiClient, workspaceId, { platform: form.platform, ...shared });
      await onSaved(!pixel);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      setFormError(Object.keys(fields).length ? null : errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={pixel ? t.editTitle : t.addTitle}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            form="tracking-pixel-form"
            disabled={
              saving || id === "" || idBad || tokenMissing || scopeMissing || adAccountBad !== null || purchaseLabelBad || leadLabelBad
            }
          >
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id="tracking-pixel-form" onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}

        <Field label={t.platform}>
          {({ id: fieldId }) => (
            <Select
              id={fieldId}
              value={form.platform}
              disabled={Boolean(pixel)}
              onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value as TrackingPixelPlatform, capiEnabled: false }))}
            >
              {platforms.map((p) => (
                <option key={p.name} value={p.name}>
                  {PLATFORM_META[p.name]?.name ?? p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <TextField
          label={t.pixelId}
          dir="ltr"
          required
          autoComplete="off"
          value={form.pixelId}
          placeholder={meta.example}
          onChange={(e) => set("pixelId", e.target.value)}
          error={idBad ? t.invalid : fieldErrors.pixelId}
        />

        <TextField label={t.label} value={form.label} maxLength={120} hint={t.labelHint} onChange={(e) => set("label", e.target.value)} />

        {isAdsId && (
          <>
            <TextField
              label={t.adsLabel}
              dir="ltr"
              autoComplete="off"
              maxLength={60}
              value={form.adsConversionLabel}
              hint={t.adsLabelHint}
              onChange={(e) => setLabel("adsConversionLabel", e.target.value)}
              error={labelError(purchaseLabelBad, "config.adsConversionLabel")}
            />
            <TextField
              label={t.adsLeadLabel}
              dir="ltr"
              autoComplete="off"
              maxLength={60}
              value={form.adsLeadLabel}
              hint={t.adsLeadLabelHint}
              onChange={(e) => setLabel("adsLeadLabel", e.target.value)}
              error={labelError(leadLabelBad, "config.adsLeadLabel")}
            />
          </>
        )}

        {capiPossible && pinterest && (
          <PinterestCapiFields
            enabled={form.capiEnabled}
            onEnabledChange={(next) => set("capiEnabled", next)}
            adAccountId={form.adAccountId}
            onAdAccountIdChange={(next) => {
              set("adAccountId", next);
              setFieldErrors((prev) => ({ ...prev, "config.adAccountId": "" }));
            }}
            adAccountProblem={adAccountProblem}
            token={form.capiToken}
            onTokenChange={(next) => set("capiToken", next)}
            tokenMissing={tokenMissing}
            tokenError={fieldErrors.capiToken}
            tokenMask={tokenSaved ? (pixel?.capiTokenMask ?? "••••") : null}
            testEventCode={form.testEventCode}
            onTestEventCodeChange={(next) => set("testEventCode", next)}
            warning={t.capiWarning}
          />
        )}
        {capiPossible && !pinterest && (
          <div className="space-y-3 rounded-[0.5rem] border border-line p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 cursor-pointer accent-primary"
                checked={form.capiEnabled}
                onChange={(e) => set("capiEnabled", e.target.checked)}
              />
              <span className="text-sm font-medium text-ink">{t.capiEnabled}</span>
            </label>
            {form.capiEnabled && (
              <>
                <Alert>{t.capiWarning}</Alert>
                <TextField
                  label={t.capiToken}
                  dir="ltr"
                  type="password"
                  autoComplete="off"
                  value={form.capiToken}
                  onChange={(e) => set("capiToken", e.target.value)}
                  error={tokenMissing ? t.capiTokenRequired : fieldErrors.capiToken}
                  hint={
                    tokenSaved
                      ? fmt(t.capiTokenKeep, { mask: pixel?.capiTokenMask ?? "••••" })
                      : form.platform === "google"
                        ? t.capiTokenGa4
                        : undefined
                  }
                />
                {info?.testEventCode && (
                  <TextField
                    label={t.testCode}
                    dir="ltr"
                    autoComplete="off"
                    value={form.testEventCode}
                    hint={t.testCodeHint}
                    onChange={(e) => set("testEventCode", e.target.value)}
                  />
                )}
              </>
            )}
          </div>
        )}

        <Field label={t.scope} error={scopeMissing && options && !options.loading ? t.scopeRequired : fieldErrors.ids}>
          {({ id: fieldId }) => (
            <Select
              id={fieldId}
              value={form.scopeType}
              onChange={(e) => setForm((prev) => ({ ...prev, scopeType: e.target.value as TrackingPixelScopeType, scopeIds: [] }))}
            >
              <option value="all">{t.scopeAll}</option>
              <option value="funnels">{t.chooseFunnels}</option>
              <option value="products">{t.chooseProducts}</option>
            </Select>
          )}
        </Field>

        {options && (
          <DataState loading={options.loading} error={options.error} onRetry={() => void options.refresh()}>
            {(options.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-soft">{t.scopeEmpty}</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-[0.5rem] border border-line p-2">
                {(options.data ?? []).map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-ink hover:bg-paper">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-primary"
                        checked={scopeIdSet.has(item.id)}
                        onChange={(e) =>
                          set("scopeIds", e.target.checked ? [...form.scopeIds, item.id] : form.scopeIds.filter((x) => x !== item.id))
                        }
                      />
                      <span className="min-w-0 truncate">{item.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </DataState>
        )}
      </form>
    </Modal>
  );
}
